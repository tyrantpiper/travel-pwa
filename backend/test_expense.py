from supabase import create_client
import os
from dotenv import load_dotenv
import requests
load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')
supabase = create_client(url, key)

# 列出可用的 itineraries
result = supabase.table('itineraries').select('id, title').limit(5).execute()
print('Available itineraries:')
for r in result.data:
    print(f"  {r['id']} - {r['title']}")

if result.data:
    trip_id = result.data[0]['id']
    print(f"\nTesting with trip_id: {trip_id}")
    
    # 測試新增費用
    r = requests.post('http://localhost:8000/api/expenses', json={
        'itinerary_id': trip_id,
        'title': 'test expense',
        'amount_jpy': 100,
        'is_public': True,
        'created_by': 'daec9523-d377-4752-bed8-17efe5bba1e5',
        'category': 'food',
        'payment_method': 'Cash'
    })
    print(f'Status: {r.status_code}')
    print(f'Response: {r.text}')
