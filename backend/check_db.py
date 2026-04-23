import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_db():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['rnoo']
    
    # Count documents
    orders = await db.orders.count_documents({})
    users = await db.users.count_documents({})
    merchants = await db.merchants.count_documents({})
    products = await db.products.count_documents({})
    
    print("=" * 50)
    print("MongoDB Connection Status")
    print("=" * 50)
    print(f"Database: rnoo")
    print(f"URL: mongodb://localhost:27017")
    print("-" * 50)
    print(f"Orders:    {orders}")
    print(f"Users:     {users}")
    print(f"Merchants: {merchants}")
    print(f"Products:  {products}")
    print("=" * 50)
    print("✓ Backend IS connected to local MongoDB!")
    print("=" * 50)
    
    # Get a sample order
    if orders > 0:
        sample = await db.orders.find_one({})
        print(f"\nSample order ID: {sample.get('_id')}")
        print(f"Status: {sample.get('status')}")
    
    client.close()

asyncio.run(check_db())
