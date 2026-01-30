"""
FastAPI Backend for LineJudge Web Interface
Provides REST API and WebSocket support to control the odds comparison system
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import uuid
import threading
import time
from datetime import datetime
import json
from pathlib import Path
import logging

# Import your existing comparison code
from linejudge import OddsComparator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LineJudge API", version="1.0.0")

# CORS middleware for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active sessions storage
active_sessions: Dict[str, Dict[str, Any]] = {}
websocket_connections: Dict[str, List[WebSocket]] = {}


# Pydantic models
class StartSessionRequest(BaseModel):
    urls: List[str]
    fetchInterval: int = 2
    displayInterval: int = 5


class SessionResponse(BaseModel):
    sessionId: str
    status: str
    message: str


class SessionStatusResponse(BaseModel):
    sessionId: str
    status: str
    startTime: str
    currentOdds: Dict[str, Any]
    latestArbitrage: Optional[Dict[str, Any]]
    totalComparisons: int
    totalArbitrageOpportunities: int
    matchStatus: Dict[str, Any]


# Background task to broadcast updates
async def broadcast_updates(session_id: str):
    """Continuously broadcast session updates to connected WebSocket clients"""
    while session_id in active_sessions and active_sessions[session_id]["status"] == "running":
        try:
            session = active_sessions[session_id]
            comparator = session["comparator"]
            
            # Get current state
            with comparator.odds_lock:
                current_odds = dict(comparator.current_odds)
            
            # Get latest arbitrage
            latest_arbitrage = None
            if comparator.odds_history['arbitrage_opportunities']:
                latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
            
            # Prepare update payload
            update = {
                "type": "update",
                "sessionId": session_id,
                "currentOdds": current_odds,
                "latestArbitrage": latest_arbitrage,
                "totalComparisons": len(comparator.odds_history['comparisons']),
                "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
                "matchStatus": comparator.match_status,
                "timestamp": datetime.now().isoformat()
            }
            
            # Broadcast to all connected clients for this session
            if session_id in websocket_connections:
                disconnected = []
                for ws in websocket_connections[session_id]:
                    try:
                        await ws.send_json(update)
                    except Exception as e:
                        logger.error(f"Error sending to websocket: {e}")
                        disconnected.append(ws)
                
                # Remove disconnected clients
                for ws in disconnected:
                    websocket_connections[session_id].remove(ws)
            
            await asyncio.sleep(2)  # Broadcast every 2 seconds
            
        except Exception as e:
            logger.error(f"Error in broadcast loop: {e}")
            await asyncio.sleep(2)


def run_comparator_thread(session_id: str, urls: List[str], fetch_interval: int, display_interval: int):
    """Run the OddsComparator in a separate thread"""
    try:
        session = active_sessions[session_id]
        comparator = session["comparator"]
        
        # Override the compare_and_display method to not print to console
        original_compare_and_display = comparator.compare_and_display
        
        def silent_compare_and_display():
            """Silent version that updates data without printing"""
            with comparator.odds_lock:
                num_books = len(comparator.current_odds)
                if num_books < 2:
                    return
                
                # Filter out invalid data
                from collections import defaultdict
                valid_matches = []
                stale_matches = []
                invalid_matches = []
                
                for match_id, match in comparator.current_odds.items():
                    if comparator._is_data_invalid(match_id):
                        invalid_matches.append((match_id, match))
                    elif match.get('status') == 'stale' or comparator._is_data_stale(match_id):
                        stale_matches.append((match_id, match))
                    else:
                        valid_matches.append(match)
                
                active_matches = valid_matches
                
                if len(active_matches) < 2:
                    return
                
                has_data = all(match.get('odds') for match in active_matches)
                if not has_data:
                    return
                
                # Create player mapping
                player_odds = defaultdict(dict)
                
                for match in active_matches:
                    sportsbook = match['sportsbook']
                    for player_data in match['odds']:
                        player_name = player_data['player']
                        normalized_name = comparator.normalize_player_name(player_name)
                        odds_value = player_data['odds']
                        
                        player_odds[normalized_name][sportsbook] = {
                            'original_name': player_name,
                            'odds': odds_value,
                            'numeric': comparator.convert_odds_to_decimal(odds_value)
                        }
                
                matching_players = [player for player, books in player_odds.items() if len(books) >= 2]
                
                if not matching_players:
                    return
                
                # Calculate arbitrage
                arbitrage = comparator.calculate_arbitrage(player_odds)
                
                # Store comparison data
                comparison_data = {
                    'timestamp': datetime.now().isoformat(),
                    'active_books': len(active_matches),
                    'stale_books': len(stale_matches),
                    'invalid_books': len(invalid_matches),
                    'players': {},
                    'arbitrage': arbitrage
                }
                
                # Store player data
                for player, books in player_odds.items():
                    if len(books) >= 2:
                        player_comparison = {}
                        for sportsbook, data in books.items():
                            decimal = data['numeric']
                            implied_prob = (1 / decimal) * 100 if decimal > 0 else 0
                            player_comparison[sportsbook] = {
                                'odds': data['odds'],
                                'decimal': decimal,
                                'implied_probability': implied_prob
                            }
                        comparison_data['players'][player] = player_comparison
                
                if arbitrage:
                    comparison_data['arbitrage'] = arbitrage
                    comparator.odds_history['arbitrage_opportunities'].append({
                        'timestamp': datetime.now().isoformat(),
                        'arbitrage': arbitrage
                    })
                    
                    if not comparator.arbitrage_found:
                        comparator.arbitrage_found = True
                        logger.info(f"ARBITRAGE FOUND in session {session_id}: {arbitrage['profit_percentage']:.3f}% profit")
                
                comparator.odds_history['comparisons'].append(comparison_data)
        
        comparator.compare_and_display = silent_compare_and_display
        
        # Start monitoring
        logger.info(f"Starting comparator thread for session {session_id}")
        
        # Initialize scrapers and start threads
        from scrapers import ScraperFactory
        from threading import Thread
        
        for idx, url in enumerate(urls, 1):
            factory = ScraperFactory()
            scraper = factory.get_scraper(url)
            if scraper:
                match_info = {
                    'match_id': idx,
                    'sportsbook': scraper.get_sportsbook_name(),
                    'url': url
                }
                comparator.odds_history['matches'].append(match_info)
                logger.info(f"Match {idx}: {match_info['sportsbook']}")
        
        # Start monitoring threads
        threads = []
        for idx, url in enumerate(urls, 1):
            thread = Thread(target=comparator.monitor_single_match, args=(url, idx, fetch_interval))
            thread.daemon = True
            thread.start()
            threads.append(thread)
        
        time.sleep(2)
        
        # Main comparison loop
        last_display = 0
        last_health_check = 0
        
        while comparator.running and session["status"] == "running":
            current_time = time.time()
            
            # Run comparison
            if current_time - last_display >= display_interval:
                comparator.compare_and_display()
                last_display = current_time
            
            # Health check
            if current_time - last_health_check >= 30:
                health = comparator.get_health_summary()
                logger.info(f"Session {session_id} Health: {health['active']} active, {health['stale']} stale")
                last_health_check = current_time
            
            time.sleep(1)
        
        # Cleanup
        logger.info(f"Stopping session {session_id}")
        comparator.running = False
        
        for thread in threads:
            thread.join(timeout=2)
        
        # Save data
        if comparator.odds_history['comparisons']:
            filepath = comparator.save_comparison_data()
            session["data_file"] = str(filepath)
            logger.info(f"Session {session_id} data saved to {filepath}")
        
    except Exception as e:
        logger.error(f"Error in comparator thread for session {session_id}: {e}")
        import traceback
        traceback.print_exc()
        active_sessions[session_id]["status"] = "error"
        active_sessions[session_id]["error"] = str(e)


# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "LineJudge API v1.0",
        "status": "operational",
        "active_sessions": len(active_sessions)
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_sessions": len(active_sessions),
        "sessions": {
            sid: {"status": s["status"], "urls": len(s["urls"])}
            for sid, s in active_sessions.items()
        }
    }


@app.post("/start", response_model=SessionResponse)
async def start_session(request: StartSessionRequest):
    """Start a new odds comparison session"""
    if len(request.urls) < 2:
        raise HTTPException(status_code=400, detail="At least 2 URLs required")
    
    session_id = str(uuid.uuid4())
    
    # Create comparator instance
    comparator = OddsComparator()
    
    # Store session
    active_sessions[session_id] = {
        "id": session_id,
        "urls": request.urls,
        "comparator": comparator,
        "status": "running",
        "start_time": datetime.now().isoformat(),
        "fetch_interval": request.fetchInterval,
        "display_interval": request.displayInterval
    }
    
    # Start comparator in background thread
    thread = threading.Thread(
        target=run_comparator_thread,
        args=(session_id, request.urls, request.fetchInterval, request.displayInterval),
        daemon=True
    )
    thread.start()
    active_sessions[session_id]["thread"] = thread
    
    # Start WebSocket broadcast task
    asyncio.create_task(broadcast_updates(session_id))
    
    logger.info(f"Started session {session_id} with {len(request.urls)} URLs")
    
    return SessionResponse(
        sessionId=session_id,
        status="started",
        message=f"Monitoring {len(request.urls)} sportsbooks"
    )


@app.post("/stop")
async def stop_session(sessionId: str):
    """Stop an active session"""
    if sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[sessionId]
    comparator = session["comparator"]
    
    # Signal to stop
    comparator.running = False
    session["status"] = "stopped"
    
    logger.info(f"Stopped session {sessionId}")
    
    return SessionResponse(
        sessionId=sessionId,
        status="stopped",
        message="Monitoring stopped"
    )


@app.get("/session/{sessionId}/status")
async def get_session_status(sessionId: str):
    """Get current session status and latest data"""
    if sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[sessionId]
    comparator = session["comparator"]
    
    # Get current odds data
    with comparator.odds_lock:
        current_odds = dict(comparator.current_odds)
    
    # Get latest arbitrage
    latest_arbitrage = None
    if comparator.odds_history['arbitrage_opportunities']:
        latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
    
    return {
        "sessionId": sessionId,
        "status": session["status"],
        "startTime": session["start_time"],
        "currentOdds": current_odds,
        "latestArbitrage": latest_arbitrage,
        "totalComparisons": len(comparator.odds_history['comparisons']),
        "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
        "matchStatus": comparator.match_status
    }


@app.get("/session/{sessionId}/health")
async def get_session_health(sessionId: str):
    """Get health summary for a session"""
    if sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[sessionId]
    comparator = session["comparator"]
    
    health = comparator.get_health_summary()
    return health


@app.get("/session/{sessionId}/history")
async def get_session_history(sessionId: str):
    """Get full comparison history for a session"""
    if sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[sessionId]
    comparator = session["comparator"]
    
    return {
        "sessionId": sessionId,
        "history": comparator.odds_history
    }


@app.delete("/session/{sessionId}")
async def delete_session(sessionId: str):
    """Delete a session and clean up resources"""
    if sessionId not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[sessionId]
    
    # Stop if still running
    if session["status"] == "running":
        comparator = session["comparator"]
        comparator.running = False
        time.sleep(1)  # Give it a moment to stop
    
    # Remove from active sessions
    del active_sessions[sessionId]
    
    # Clean up websocket connections
    if sessionId in websocket_connections:
        del websocket_connections[sessionId]
    
    logger.info(f"Deleted session {sessionId}")
    
    return {"message": f"Session {sessionId} deleted"}


@app.get("/sessions")
async def list_sessions():
    """List all active sessions"""
    sessions = []
    for session_id, session in active_sessions.items():
        sessions.append({
            "sessionId": session_id,
            "status": session["status"],
            "startTime": session["start_time"],
            "urlCount": len(session["urls"]),
            "totalComparisons": len(session["comparator"].odds_history['comparisons']),
            "totalArbitrageOpportunities": len(session["comparator"].odds_history['arbitrage_opportunities'])
        })
    
    return {"sessions": sessions, "count": len(sessions)}


# WebSocket endpoint for real-time updates
@app.websocket("/ws/{sessionId}")
async def websocket_endpoint(websocket: WebSocket, sessionId: str):
    """WebSocket endpoint for real-time session updates"""
    if sessionId not in active_sessions:
        await websocket.close(code=1008, reason="Session not found")
        return
    
    await websocket.accept()
    
    # Register this connection
    if sessionId not in websocket_connections:
        websocket_connections[sessionId] = []
    websocket_connections[sessionId].append(websocket)
    
    logger.info(f"WebSocket client connected to session {sessionId}")
    
    try:
        # Send initial state
        session = active_sessions[sessionId]
        comparator = session["comparator"]
        
        with comparator.odds_lock:
            current_odds = dict(comparator.current_odds)
        
        latest_arbitrage = None
        if comparator.odds_history['arbitrage_opportunities']:
            latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
        
        await websocket.send_json({
            "type": "initial",
            "sessionId": sessionId,
            "status": session["status"],
            "currentOdds": current_odds,
            "latestArbitrage": latest_arbitrage,
            "totalComparisons": len(comparator.odds_history['comparisons']),
            "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
            "matchStatus": comparator.match_status
        })
        
        # Keep connection alive and listen for client messages
        while True:
            data = await websocket.receive_text()
            # Could handle client messages here if needed
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from session {sessionId}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Unregister connection
        if sessionId in websocket_connections:
            if websocket in websocket_connections[sessionId]:
                websocket_connections[sessionId].remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)