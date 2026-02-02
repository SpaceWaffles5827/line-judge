"""
FastAPI Backend for LineJudge Web Interface - Multi-Match Support (Single User)
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
from collections import defaultdict
import logging

from linejudge import OddsComparator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LineJudge API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple storage - just matches
active_matches: Dict[str, Dict[str, Any]] = {}  # matchId -> match data
websocket_connections: List[WebSocket] = []  # All websocket connections


# Pydantic models
class CreateMatchRequest(BaseModel):
    urls: List[str]
    matchName: Optional[str] = None
    sport: Optional[str] = None
    fetchInterval: int = 2
    displayInterval: int = 5


class MatchResponse(BaseModel):
    matchId: str
    matchName: str
    status: str
    message: str


# Background broadcast for a specific match
async def broadcast_match_updates(match_id: str):
    """Continuously broadcast match updates to connected WebSocket clients"""
    while match_id in active_matches and active_matches[match_id]["status"] == "running":
        try:
            match = active_matches[match_id]
            comparator = match["comparator"]
            
            with comparator.odds_lock:
                current_odds = dict(comparator.current_odds)
            
            latest_arbitrage = None
            if comparator.odds_history['arbitrage_opportunities']:
                latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
            
            update = {
                "type": "match_update",
                "matchId": match_id,
                "currentOdds": current_odds,
                "latestArbitrage": latest_arbitrage,
                "totalComparisons": len(comparator.odds_history['comparisons']),
                "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
                "matchStatus": comparator.match_status,
                "timestamp": datetime.now().isoformat()
            }
            
            # Broadcast to all websocket connections
            disconnected = []
            for ws in websocket_connections:
                try:
                    await ws.send_json(update)
                except Exception as e:
                    logger.error(f"Error sending to websocket: {e}")
                    disconnected.append(ws)
            
            for ws in disconnected:
                if ws in websocket_connections:
                    websocket_connections.remove(ws)
            
            await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"Error in broadcast loop for match {match_id}: {e}")
            await asyncio.sleep(2)


def run_match_comparator(match_id: str, urls: List[str], fetch_interval: int, display_interval: int):
    """Run comparator for a specific match in a separate thread"""
    try:
        match = active_matches[match_id]
        comparator = match["comparator"]
        
        def silent_compare_and_display():
            with comparator.odds_lock:
                num_books = len(comparator.current_odds)
                if num_books < 2:
                    return
                
                valid_matches = []
                stale_matches = []
                invalid_matches = []
                
                for match_id_inner, match_data in comparator.current_odds.items():
                    if comparator._is_data_invalid(match_id_inner):
                        invalid_matches.append((match_id_inner, match_data))
                    elif match_data.get('status') == 'stale' or comparator._is_data_stale(match_id_inner):
                        stale_matches.append((match_id_inner, match_data))
                    else:
                        valid_matches.append(match_data)
                
                active_matches_data = valid_matches
                
                if len(active_matches_data) < 2:
                    return
                
                has_data = all(m.get('odds') for m in active_matches_data)
                if not has_data:
                    return
                
                player_odds = defaultdict(dict)
                
                for match_data in active_matches_data:
                    sportsbook = match_data['sportsbook']
                    for player_data in match_data['odds']:
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
                
                arbitrage = comparator.calculate_arbitrage(player_odds)
                
                comparison_data = {
                    'timestamp': datetime.now().isoformat(),
                    'active_books': len(active_matches_data),
                    'stale_books': len(stale_matches),
                    'invalid_books': len(invalid_matches),
                    'players': {},
                    'arbitrage': arbitrage
                }
                
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
                        logger.info(f"ARBITRAGE in match {match_id}: {arbitrage['profit_percentage']:.3f}%")
                
                comparator.odds_history['comparisons'].append(comparison_data)
        
        comparator.compare_and_display = silent_compare_and_display
        
        logger.info(f"Starting comparator for match {match_id}")
        
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
        
        threads = []
        for idx, url in enumerate(urls, 1):
            thread = Thread(target=comparator.monitor_single_match, args=(url, idx, fetch_interval))
            thread.daemon = True
            thread.start()
            threads.append(thread)
        
        time.sleep(2)
        
        last_display = 0
        last_health_check = 0
        
        while comparator.running and match["status"] == "running":
            current_time = time.time()
            
            if current_time - last_display >= display_interval:
                comparator.compare_and_display()
                last_display = current_time
            
            if current_time - last_health_check >= 30:
                health = comparator.get_health_summary()
                logger.info(f"Match {match_id}: {health['active']} active, {health['stale']} stale")
                last_health_check = current_time
            
            time.sleep(1)
        
        logger.info(f"Stopping match {match_id}")
        comparator.running = False
        
        for thread in threads:
            thread.join(timeout=2)
        
        if comparator.odds_history['comparisons']:
            filepath = comparator.save_comparison_data()
            match["data_file"] = str(filepath)
            logger.info(f"Match {match_id} data saved to {filepath}")
        
    except Exception as e:
        logger.error(f"Error in match {match_id}: {e}")
        import traceback
        traceback.print_exc()
        active_matches[match_id]["status"] = "error"
        active_matches[match_id]["error"] = str(e)


# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "LineJudge API v2.0 - Single User",
        "status": "operational",
        "active_matches": len(active_matches)
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_matches": len(active_matches)
    }


@app.post("/match/create", response_model=MatchResponse)
async def create_match(request: CreateMatchRequest):
    """Create a new match"""
    if len(request.urls) < 2:
        raise HTTPException(status_code=400, detail="At least 2 URLs required")
    
    match_id = str(uuid.uuid4())
    match_name = request.matchName or f"Match {len(active_matches) + 1}"
    
    comparator = OddsComparator()
    
    active_matches[match_id] = {
        "matchId": match_id,
        "matchName": match_name,
        "sport": request.sport,
        "urls": request.urls,
        "comparator": comparator,
        "status": "running",
        "startTime": datetime.now().isoformat(),
        "fetchInterval": request.fetchInterval,
        "displayInterval": request.displayInterval
    }
    
    # Start comparator thread
    thread = threading.Thread(
        target=run_match_comparator,
        args=(match_id, request.urls, request.fetchInterval, request.displayInterval),
        daemon=True
    )
    thread.start()
    active_matches[match_id]["thread"] = thread
    
    # Start broadcast task
    asyncio.create_task(broadcast_match_updates(match_id))
    
    logger.info(f"Created match {match_id}: {match_name}")
    
    return MatchResponse(
        matchId=match_id,
        matchName=match_name,
        status="started",
        message=f"Monitoring {len(request.urls)} sportsbooks"
    )


@app.get("/matches")
async def get_all_matches():
    """Get all matches"""
    match_summaries = []
    
    for match_id, match in active_matches.items():
        comparator = match["comparator"]
        
        with comparator.odds_lock:
            current_odds = dict(comparator.current_odds)
        
        latest_arbitrage = None
        if comparator.odds_history['arbitrage_opportunities']:
            latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
        
        health = comparator.get_health_summary()
        
        match_summaries.append({
            "matchId": match_id,
            "matchName": match["matchName"],
            "sport": match.get("sport"),
            "status": match["status"],
            "startTime": match["startTime"],
            "urlCount": len(match["urls"]),
            "currentArbitrage": latest_arbitrage,
            "totalOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
            "activeBooks": health['active'],
            "staleBooks": health['stale']
        })
    
    return {"matches": match_summaries, "count": len(match_summaries)}


@app.get("/match/{matchId}")
async def get_match_details(matchId: str):
    """Get detailed information about a specific match"""
    if matchId not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match = active_matches[matchId]
    comparator = match["comparator"]
    
    with comparator.odds_lock:
        current_odds = dict(comparator.current_odds)
    
    latest_arbitrage = None
    if comparator.odds_history['arbitrage_opportunities']:
        latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
    
    return {
        "matchId": matchId,
        "matchName": match["matchName"],
        "sport": match.get("sport"),
        "status": match["status"],
        "startTime": match["startTime"],
        "currentOdds": current_odds,
        "latestArbitrage": latest_arbitrage,
        "totalComparisons": len(comparator.odds_history['comparisons']),
        "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
        "matchStatus": comparator.match_status
    }


@app.post("/match/{matchId}/stop")
async def stop_match(matchId: str):
    """Stop a specific match"""
    if matchId not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match = active_matches[matchId]
    comparator = match["comparator"]
    
    comparator.running = False
    match["status"] = "stopped"
    
    logger.info(f"Stopped match {matchId}")
    
    return MatchResponse(
        matchId=matchId,
        matchName=match["matchName"],
        status="stopped",
        message="Match stopped"
    )


@app.delete("/match/{matchId}")
async def delete_match(matchId: str):
    """Delete a match"""
    if matchId not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match = active_matches[matchId]
    
    # Stop if running
    if match["status"] == "running":
        comparator = match["comparator"]
        comparator.running = False
        time.sleep(1)
    
    # Remove match
    del active_matches[matchId]
    
    logger.info(f"Deleted match {matchId}")
    
    return {"message": f"Match {matchId} deleted"}


# WebSocket for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    websocket_connections.append(websocket)
    
    logger.info(f"WebSocket client connected (total: {len(websocket_connections)})")
    
    try:
        # Send initial state for all matches
        for match_id, match in active_matches.items():
            comparator = match["comparator"]
            
            with comparator.odds_lock:
                current_odds = dict(comparator.current_odds)
            
            latest_arbitrage = None
            if comparator.odds_history['arbitrage_opportunities']:
                latest_arbitrage = comparator.odds_history['arbitrage_opportunities'][-1]['arbitrage']
            
            await websocket.send_json({
                "type": "initial",
                "matchId": match_id,
                "matchName": match["matchName"],
                "status": match["status"],
                "currentOdds": current_odds,
                "latestArbitrage": latest_arbitrage,
                "totalComparisons": len(comparator.odds_history['comparisons']),
                "totalArbitrageOpportunities": len(comparator.odds_history['arbitrage_opportunities']),
                "matchStatus": comparator.match_status
            })
        
        while True:
            data = await websocket.receive_text()
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in websocket_connections:
            websocket_connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)