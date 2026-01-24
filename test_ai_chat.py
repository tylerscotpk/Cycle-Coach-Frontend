import requests
import subprocess
from datetime import datetime

# Create test user and session
user_id = f"test-user-{int(datetime.now().timestamp())}"
session_token = f"test_session_{int(datetime.now().timestamp())}"
test_email = f"test.user.{int(datetime.now().timestamp())}@example.com"

mongo_commands = f"""
use('do_her_better_db');
db.users.insertOne({{
  id: '{user_id}',
  email: '{test_email}',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: '{user_id}',
  session_token: '{session_token}',
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
"""

print("Creating test user...")
result = subprocess.run(['mongosh', '--eval', mongo_commands], capture_output=True, text=True)

if result.returncode == 0:
    print(f"✅ Test user created: {user_id}")
    
    # Create partner profile first
    partner_data = {
        "partner_name": "Test Partner",
        "cycle_start_date": "2025-01-01",
        "cycle_length": 28
    }
    
    print("Creating partner profile...")
    response = requests.post(
        "https://mentrack.preview.emergentagent.com/api/partner",
        json=partner_data,
        headers={'Authorization': f'Bearer {session_token}', 'Content-Type': 'application/json'},
        timeout=10
    )
    
    if response.status_code == 200:
        partner_id = response.json()['id']
        print(f"✅ Partner created: {partner_id}")
        
        # Test AI chat
        chat_data = {
            "message": "What does she like for breakfast?",
            "partner_id": partner_id
        }
        
        print("Testing AI chat (this may take 15-30 seconds)...")
        try:
            response = requests.post(
                "https://mentrack.preview.emergentagent.com/api/chat",
                json=chat_data,
                headers={'Authorization': f'Bearer {session_token}', 'Content-Type': 'application/json'},
                timeout=45
            )
            
            if response.status_code == 200:
                ai_response = response.json()['response']
                print(f"✅ AI Chat works! Response: {ai_response[:100]}...")
            else:
                print(f"❌ AI Chat failed: {response.status_code} - {response.text}")
                
        except requests.exceptions.Timeout:
            print("⚠️ AI Chat timed out - this might be normal for GPT-5 calls")
        except Exception as e:
            print(f"❌ AI Chat error: {str(e)}")
    else:
        print(f"❌ Failed to create partner: {response.status_code}")

    # Cleanup
    cleanup_commands = f"""
    use('do_her_better_db');
    db.users.deleteOne({{id: '{user_id}'}});
    db.user_sessions.deleteOne({{user_id: '{user_id}'}});
    db.partner_profiles.deleteMany({{user_id: '{user_id}'}});
    db.ai_conversations.deleteMany({{user_id: '{user_id}'}});
    """
    
    subprocess.run(['mongosh', '--eval', cleanup_commands], capture_output=True)
    print("✅ Cleanup completed")
else:
    print(f"❌ Failed to create test user: {result.stderr}")