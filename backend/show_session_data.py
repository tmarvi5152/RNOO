from pymongo import MongoClient

c = MongoClient('mongodb://localhost:27017')
db = c['rnoo']

print('\n' + '=' * 60)
print('YOUR MONGODB SESSION DATA')
print('=' * 60)

print('\nRECENT ORDERS:')
print('-' * 60)
orders = list(db.orders.find({}, {
    'order_id': 1, 
    'merchant_id': 1, 
    'status': 1, 
    'total': 1, 
    '_id': 0
}).limit(5))
for o in orders:
    print(f"  Order: {o.get('order_id')}")
    print(f"    Merchant: {o.get('merchant_id')}")
    print(f"    Status: {o.get('status')}")
    print(f"    Total: ${o.get('total', 0)}")
    print()

print('\nUSERS IN DATABASE:')
print('-' * 60)
users = list(db.users.find({}, {'email': 1, 'role': 1, '_id': 0}))
for u in users:
    print(f"  • {u.get('email')} - Role: {u.get('role')}")

print('\nMERCHANTS:')
print('-' * 60)
merchants = list(db.merchants.find({}, {'business_name': 1, 'merchant_id': 1, '_id': 0}))
for m in merchants:
    print(f"  • {m.get('business_name')} (ID: {m.get('merchant_id')})")

print('\n' + '=' * 60)
print('✓ SESSION IS CONNECTED TO LOCAL DATABASE!')
print('=' * 60)
print()
