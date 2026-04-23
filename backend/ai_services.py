"""
AI Services for RPOWER Native Online Ordering
Provides intelligent features like menu recommendations, order analysis, and merchant insights
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
import math
import json
from collections import Counter

class AIRecommendationEngine:
    """AI-powered menu item recommendations based on order history"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_recommended_items(
        self, 
        merchant_id: str, 
        customer_email: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get personalized menu recommendations for a customer
        
        Strategy:
        1. If customer has order history: recommend items they haven't tried + popular items
        2. If new customer: recommend most popular items + trending items
        3. Consider dietary patterns from previous orders
        """
        recommendations = []
        
        # Get all menu items for the merchant
        all_items = await self.db.menu_items.find(
            {"merchant_id": merchant_id, "is_available": True},
            {"_id": 0}
        ).to_list(500)
        
        if not all_items:
            return []
        
        # If customer email provided, get their order history
        if customer_email:
            customer_orders = await self.db.orders.find(
                {"merchant_id": merchant_id, "customer.email": customer_email},
                {"_id": 0}
            ).to_list(100)
            
            if customer_orders:
                # Get items they've already ordered
                ordered_item_ids = set()
                item_scores = {}
                
                for order in customer_orders:
                    for item in order.get("items", []):
                        ordered_item_ids.add(item.get("menu_item_id"))
                
                # Recommend items they haven't tried
                new_items = [item for item in all_items if item["id"] not in ordered_item_ids]
                
                if new_items:
                    # Score new items based on popularity
                    new_items_scored = await self._score_items_by_popularity(
                        new_items, merchant_id
                    )
                    recommendations.extend(new_items_scored[:limit])
                
                # If not enough recommendations, add popular items they've ordered
                if len(recommendations) < limit:
                    popular_tried = await self._score_items_by_popularity(
                        [item for item in all_items if item["id"] in ordered_item_ids],
                        merchant_id
                    )
                    recommendations.extend(popular_tried[:limit - len(recommendations)])
            else:
                # New customer - recommend popular items
                recommendations = await self._score_items_by_popularity(all_items, merchant_id)
        else:
            # No customer data - recommend popular items
            recommendations = await self._score_items_by_popularity(all_items, merchant_id)
        
        return recommendations[:limit]
    
    async def _score_items_by_popularity(
        self, 
        items: List[Dict], 
        merchant_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Score items by order frequency and recency"""
        
        # Get orders from last N days
        since = datetime.now(timezone.utc) - timedelta(days=days)
        recent_orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0, "items": 1}
        ).to_list(200)
        
        # Count order frequency for each item
        item_order_count = Counter()
        item_revenue = {}
        
        for order in recent_orders:
            for item in order.get("items", []):
                item_id = item.get("menu_item_id")
                quantity = item.get("quantity", 1)
                price = item.get("unit_price", 0)
                
                item_order_count[item_id] += quantity
                if item_id not in item_revenue:
                    item_revenue[item_id] = 0
                item_revenue[item_id] += price * quantity
        
        # Score items: popularity + revenue contribution
        scored_items = []
        for item in items:
            order_count = item_order_count.get(item["id"], 0)
            revenue = item_revenue.get(item["id"], 0)
            
            # Score = (order count * 0.6) + (revenue / 100 * 0.4)
            score = (order_count * 0.6) + (revenue / 100 * 0.4)
            
            scored_items.append({
                **item,
                "recommendation_score": round(score, 2),
                "order_count": order_count,
                "revenue_contribution": round(revenue, 2)
            })
        
        # Sort by score, highest first
        scored_items.sort(key=lambda x: x["recommendation_score"], reverse=True)
        
        return scored_items
    
    async def get_trending_items(
        self, 
        merchant_id: str,
        days: int = 7,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get items with fastest growth in orders"""
        
        # Compare two periods: current period and previous period
        current_period_start = datetime.now(timezone.utc) - timedelta(days=days)
        previous_period_start = current_period_start - timedelta(days=days)
        
        # Get items ordered in current period
        current_orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {"$gte": current_period_start.isoformat()}
            },
            {"_id": 0, "items": 1}
        ).to_list(200)
        
        current_item_count = Counter()
        for order in current_orders:
            for item in order.get("items", []):
                current_item_count[item.get("menu_item_id")] += item.get("quantity", 1)
        
        # Get items ordered in previous period
        previous_orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {
                    "$gte": previous_period_start.isoformat(),
                    "$lt": current_period_start.isoformat()
                }
            },
            {"_id": 0, "items": 1}
        ).to_list(200)
        
        previous_item_count = Counter()
        for order in previous_orders:
            for item in order.get("items", []):
                previous_item_count[item.get("menu_item_id")] += item.get("quantity", 1)
        
        # Calculate growth rate
        trending_items = []
        for item_id, current_count in current_item_count.items():
            previous_count = previous_item_count.get(item_id, 0)
            
            if previous_count > 0:
                growth_rate = ((current_count - previous_count) / previous_count) * 100
            else:
                # New item this period
                growth_rate = 100 if current_count > 0 else 0
            
            if growth_rate > 0:  # Only include positive trends
                item = await self.db.menu_items.find_one({"id": item_id}, {"_id": 0})
                if item:
                    trending_items.append({
                        **item,
                        "growth_rate": round(growth_rate, 1),
                        "current_period_orders": current_count,
                        "previous_period_orders": previous_count
                    })
        
        # Sort by growth rate
        trending_items.sort(key=lambda x: x["growth_rate"], reverse=True)
        
        return trending_items[:limit]


class AIMerchantInsights:
    """AI-generated insights for merchants"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_sales_insights(self, merchant_id: str) -> Dict[str, Any]:
        """Generate sales insights and trends"""
        
        # Get orders from last 30 days
        since = datetime.now(timezone.utc) - timedelta(days=30)
        orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0}
        ).to_list(200)
        
        if not orders:
            return {
                "total_orders": 0,
                "total_revenue": 0,
                "average_order_value": 0,
                "insights": ["No orders in the selected period"]
            }
        
        # Calculate metrics
        total_orders = len(orders)
        total_revenue = sum(order.get("total", 0) for order in orders)
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        # Day of week analysis
        orders_by_day = Counter()
        revenue_by_day = {}
        
        for order in orders:
            try:
                order_date = datetime.fromisoformat(order.get("created_at", ""))
                day_name = order_date.strftime("%A")
                orders_by_day[day_name] += 1
                
                if day_name not in revenue_by_day:
                    revenue_by_day[day_name] = 0
                revenue_by_day[day_name] += order.get("total", 0)
            except:
                pass
        
        # Find best day
        best_day = max(orders_by_day, key=orders_by_day.get) if orders_by_day else None
        worst_day = min(orders_by_day, key=orders_by_day.get) if orders_by_day else None
        
        # Delivery type analysis
        delivery_types = Counter()
        for order in orders:
            delivery_types[order.get("delivery_type", "UNKNOWN")] += 1
        
        # Order status analysis
        status_counts = Counter()
        for order in orders:
            status_counts[order.get("status", "UNKNOWN")] += 1
        
        # Generate insights
        insights = []
        
        if total_orders > 0:
            insights.append(f"You had {total_orders} orders in the last 30 days")
            insights.append(f"Average order value: ${avg_order_value:.2f}")
        
        if best_day:
            best_day_count = orders_by_day[best_day]
            insights.append(f"Busiest day: {best_day} with {best_day_count} orders")
        
        if worst_day and worst_day != best_day:
            worst_day_count = orders_by_day[worst_day]
            insights.append(f"Slowest day: {worst_day} with {worst_day_count} orders")
        
        # Most popular delivery type
        if delivery_types:
            popular_delivery = max(delivery_types, key=delivery_types.get)
            insights.append(f"Most popular delivery type: {popular_delivery}")
        
        # Order completion rate
        completed_orders = sum(1 for o in orders if o.get("status") == "DELIVERED")
        completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
        insights.append(f"Order completion rate: {completion_rate:.1f}%")
        
        return {
            "total_orders": total_orders,
            "total_revenue": round(total_revenue, 2),
            "average_order_value": round(avg_order_value, 2),
            "best_day": best_day,
            "worst_day": worst_day,
            "delivery_type_breakdown": dict(delivery_types),
            "order_status_breakdown": dict(status_counts),
            "insights": insights
        }
    
    async def get_menu_optimization_suggestions(self, merchant_id: str) -> Dict[str, Any]:
        """Suggest menu optimizations based on data"""
        
        suggestions = []
        
        # Get all menu items and their order counts
        menu_items = await self.db.menu_items.find(
            {"merchant_id": merchant_id, "is_available": True},
            {"_id": 0}
        ).to_list(500)
        
        if not menu_items:
            return {"suggestions": ["No menu items found"]}
        
        # Get recent orders
        since = datetime.now(timezone.utc) - timedelta(days=30)
        orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0, "items": 1}
        ).to_list(200)
        
        # Count orders per item
        item_order_count = Counter()
        for order in orders:
            for item in order.get("items", []):
                item_order_count[item.get("menu_item_id")] += item.get("quantity", 1)
        
        # Find top and bottom performers
        top_items = sorted(
            [(mid, count) for mid, count in item_order_count.items()],
            key=lambda x: x[1],
            reverse=True
        )[:5]
        
        bottom_items = sorted(
            [(mid, count) for mid, count in item_order_count.items()],
            key=lambda x: x[1]
        )[:5]
        
        # Get item details
        top_item_details = []
        for item_id, count in top_items:
            item = next((it for it in menu_items if it["id"] == item_id), None)
            if item:
                top_item_details.append({"name": item.get("name"), "orders": count})
        
        bottom_item_details = []
        for item_id, count in bottom_items:
            item = next((it for it in menu_items if it["id"] == item_id), None)
            if item:
                bottom_item_details.append({"name": item.get("name"), "orders": count})
        
        # Generate suggestions
        if top_item_details:
            top_names = ", ".join([item["name"] for item in top_item_details[:3]])
            suggestions.append(f"Your top sellers are: {top_names}. Consider featuring them more prominently or creating bundles around them.")
        
        if bottom_item_details:
            bottom_names = ", ".join([item["name"] for item in bottom_item_details[:3]])
            suggestions.append(f"These items have low sales: {bottom_names}. Consider redesigning descriptions, adjusting prices, or promoting them.")
        
        # Price analysis - items priced too high/low relative to popularity
        for item in menu_items[:10]:  # Sample first 10
            orders = item_order_count.get(item["id"], 0)
            price = item.get("price", 0)
            
            if orders > 10 and price < 5:
                suggestions.append(f"'{item.get('name')}' is very popular at ${price:.2f}. Consider raising the price slightly.")
            elif orders < 2 and price > 15:
                suggestions.append(f"'{item.get('name')}' has low demand at ${price:.2f}. Consider lowering the price or revising the description.")
        
        # Uncategorized items check
        items_without_description = sum(1 for item in menu_items if not item.get("description"))
        if items_without_description > 0:
            suggestions.append(f"You have {items_without_description} items without descriptions. Adding descriptions can boost sales.")
        
        return {
            "suggestions": suggestions if suggestions else ["Menu looks optimized! Keep monitoring sales trends."],
            "top_sellers": top_item_details,
            "low_performers": bottom_item_details
        }
    
    async def get_peak_hours_analysis(self, merchant_id: str) -> Dict[str, Any]:
        """Analyze peak ordering hours"""
        
        # Get orders from last 7 days
        since = datetime.now(timezone.utc) - timedelta(days=7)
        orders = await self.db.orders.find(
            {
                "merchant_id": merchant_id,
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0, "created_at": 1, "total": 1}
        ).to_list(200)
        
        if not orders:
            return {"peak_hours": [], "insights": ["No order data available"]}
        
        # Group by hour
        orders_by_hour = Counter()
        revenue_by_hour = {}
        
        for order in orders:
            try:
                order_time = datetime.fromisoformat(order.get("created_at", ""))
                hour = order_time.strftime("%H:00")
                orders_by_hour[hour] += 1
                
                if hour not in revenue_by_hour:
                    revenue_by_hour[hour] = 0
                revenue_by_hour[hour] += order.get("total", 0)
            except:
                pass
        
        # Sort by order count
        peak_hours = sorted(
            orders_by_hour.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Format results
        peak_hours_formatted = [
            {
                "hour": hour,
                "orders": count,
                "revenue": round(revenue_by_hour.get(hour, 0), 2)
            }
            for hour, count in peak_hours
        ]
        
        insights = []
        if peak_hours_formatted:
            top_hour = peak_hours_formatted[0]
            insights.append(f"Peak hour: {top_hour['hour']} with {top_hour['orders']} orders")
            insights.append(f"Ensure adequate staffing during {top_hour['hour']}")
        
        return {
            "peak_hours": peak_hours_formatted[:5],
            "insights": insights
        }


class AIOrderAnalyzer:
    """AI-powered order analysis and predictions"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def predict_next_order_items(
        self,
        merchant_id: str,
        customer_email: str,
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """Predict what items a customer might order next based on their history"""
        
        # Get customer's order history
        customer_orders = await self.db.orders.find(
            {"merchant_id": merchant_id, "customer.email": customer_email},
            {"_id": 0, "items": 1}
        ).sort("created_at", -1).to_list(10)
        
        if len(customer_orders) < 2:
            # Not enough history - use popular items instead
            return await self._get_popular_items(merchant_id, limit)
        
        # Analyze patterns
        recent_items = []
        previous_items = []
        
        for i, order in enumerate(customer_orders):
            for item in order.get("items", []):
                if i == 0:  # Most recent order
                    recent_items.append(item.get("menu_item_id"))
                else:  # Older orders
                    previous_items.append(item.get("menu_item_id"))
        
        # Items they've ordered but not in most recent order (likely to order again)
        predictable_items = set(previous_items) - set(recent_items)
        
        if not predictable_items:
            # Fallback to popular items
            return await self._get_popular_items(merchant_id, limit)
        
        # Get item details and score by frequency
        items_info = []
        for item_id in predictable_items:
            item = await self.db.menu_items.find_one({"id": item_id}, {"_id": 0})
            if item:
                frequency = previous_items.count(item_id)
                items_info.append({**item, "prediction_score": frequency})
        
        # Sort by frequency
        items_info.sort(key=lambda x: x["prediction_score"], reverse=True)
        
        return items_info[:limit]
    
    async def _get_popular_items(self, merchant_id: str, limit: int) -> List[Dict[str, Any]]:
        """Fallback to getting popular items"""
        since = datetime.now(timezone.utc) - timedelta(days=30)
        orders = await self.db.orders.find(
            {"merchant_id": merchant_id, "created_at": {"$gte": since.isoformat()}},
            {"_id": 0, "items": 1}
        ).to_list(100)
        
        item_count = Counter()
        for order in orders:
            for item in order.get("items", []):
                item_count[item.get("menu_item_id")] += 1
        
        top_item_ids = [item_id for item_id, _ in item_count.most_common(limit)]
        
        items = []
        for item_id in top_item_ids:
            item = await self.db.menu_items.find_one({"id": item_id}, {"_id": 0})
            if item:
                items.append(item)
        
        return items
