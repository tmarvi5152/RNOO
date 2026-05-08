import os
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import asyncio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

@pytest.mark.asyncio
async def test_mongo_connection():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017')
    db_name = os.environ.get('DB_NAME', 'rnoo')
    
    print(f"Testing MongoDB connection...")
    print(f"URL: {mongo_url}")
    print(f"Database: {db_name}")
    
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        # Test the connection
        await client.admin.command('ping')
        print("✓ Successfully connected to MongoDB!")
        
        # List databases
        db_list = await client.list_database_names()
        print(f"✓ Available databases: {db_list}")
        
        # Check if rnoo database exists
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"✓ Collections in '{db_name}': {collections if collections else 'No collections yet'}")
        
        client.close()
        return True
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_mongo_connection())
    exit(0 if result else 1)
