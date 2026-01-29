import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class DoHerBetterAPITester:
    def __init__(self, base_url="https://partner-sync-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.partner_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
            self.failed_tests.append({"test": name, "error": details})

    def create_test_user_session(self):
        """Create test user and session directly in database for testing"""
        print("\n🔧 Setting up test user and session...")
        
        # Generate test data
        self.user_id = f"test-user-{int(datetime.now().timestamp())}"
        self.session_token = f"test_session_{int(datetime.now().timestamp())}"
        test_email = f"test.user.{int(datetime.now().timestamp())}@example.com"
        
        # MongoDB commands to create test user and session
        mongo_commands = f"""
        use('do_her_better_db');
        db.users.insertOne({{
          id: '{self.user_id}',
          email: '{test_email}',
          name: 'Test User',
          picture: 'https://via.placeholder.com/150',
          created_at: new Date()
        }});
        db.user_sessions.insertOne({{
          user_id: '{self.user_id}',
          session_token: '{self.session_token}',
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        """
        
        try:
            import subprocess
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print(f"✅ Test user created: {self.user_id}")
                print(f"✅ Session token: {self.session_token}")
                return True
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating test user: {str(e)}")
            return False

    def make_request(self, method, endpoint, data=None, use_auth=True):
        """Make HTTP request with optional authentication"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {str(e)}")
            return None

    def test_auth_me(self):
        """Test /api/auth/me endpoint"""
        response = self.make_request('GET', 'auth/me')
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('id') == self.user_id:
                self.log_test("Auth Me", True)
                return True
            else:
                self.log_test("Auth Me", False, f"User ID mismatch: expected {self.user_id}, got {data.get('id')}")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Auth Me", False, f"Status: {status}")
        return False

    def test_create_partner_profile(self):
        """Test creating partner profile"""
        partner_data = {
            "partner_name": "Test Partner",
            "cycle_start_date": "2025-01-01",
            "cycle_length": 28
        }
        
        response = self.make_request('POST', 'partner', partner_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.partner_id = data.get('id')
            if self.partner_id and data.get('partner_name') == "Test Partner":
                self.log_test("Create Partner Profile", True)
                return True
            else:
                self.log_test("Create Partner Profile", False, "Invalid response data")
        else:
            status = response.status_code if response else "No response"
            error_msg = response.text if response else "No response"
            self.log_test("Create Partner Profile", False, f"Status: {status}, Error: {error_msg}")
        return False

    def test_get_partner_profile(self):
        """Test getting partner profile"""
        response = self.make_request('GET', 'partner')
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('id') == self.partner_id:
                self.log_test("Get Partner Profile", True)
                return True
            else:
                self.log_test("Get Partner Profile", False, "Partner ID mismatch")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Get Partner Profile", False, f"Status: {status}")
        return False

    def test_cycle_current(self):
        """Test getting current cycle information"""
        if not self.partner_id:
            self.log_test("Get Current Cycle", False, "No partner ID available")
            return False
            
        response = self.make_request('GET', f'cycle/current?partner_id={self.partner_id}')
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ['cycle_day', 'phase', 'phase_day', 'description', 'tips']
            if all(field in data for field in required_fields):
                self.log_test("Get Current Cycle", True)
                return True
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_test("Get Current Cycle", False, f"Missing fields: {missing}")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Get Current Cycle", False, f"Status: {status}")
        return False

    def test_ai_chat(self):
        """Test AI chat functionality"""
        if not self.partner_id:
            self.log_test("AI Chat", False, "No partner ID available")
            return False
            
        chat_data = {
            "message": "What does she like for breakfast?",
            "partner_id": self.partner_id
        }
        
        response = self.make_request('POST', 'chat', chat_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'response' in data and data['response']:
                self.log_test("AI Chat", True)
                return True
            else:
                self.log_test("AI Chat", False, "No AI response received")
        else:
            status = response.status_code if response else "No response"
            error_msg = response.text if response else "No response"
            self.log_test("AI Chat", False, f"Status: {status}, Error: {error_msg}")
        return False

    def test_chat_history(self):
        """Test getting chat history"""
        if not self.partner_id:
            self.log_test("Chat History", False, "No partner ID available")
            return False
            
        response = self.make_request('GET', f'chat/history?partner_id={self.partner_id}')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_test("Chat History", True)
                return True
            else:
                self.log_test("Chat History", False, "Response is not a list")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Chat History", False, f"Status: {status}")
        return False

    def test_resources(self):
        """Test getting resources"""
        response = self.make_request('GET', 'resources')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_test("Get Resources", True)
                return True
            else:
                self.log_test("Get Resources", False, "Response is not a list")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Get Resources", False, f"Status: {status}")
        return False

    def test_seed_resources(self):
        """Test seeding resources (admin endpoint)"""
        response = self.make_request('POST', 'resources/seed', use_auth=False)
        
        if response and response.status_code == 200:
            self.log_test("Seed Resources", True)
            return True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Seed Resources", False, f"Status: {status}")
        return False

    def test_logout(self):
        """Test logout functionality"""
        response = self.make_request('POST', 'auth/logout', {})
        
        if response and response.status_code == 200:
            self.log_test("Logout", True)
            return True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Logout", False, f"Status: {status}")
        return False

    def cleanup_test_data(self):
        """Clean up test data from database"""
        print("\n🧹 Cleaning up test data...")
        
        mongo_commands = f"""
        use('do_her_better_db');
        db.users.deleteOne({{id: '{self.user_id}'}});
        db.user_sessions.deleteOne({{user_id: '{self.user_id}'}});
        db.partner_profiles.deleteMany({{user_id: '{self.user_id}'}});
        db.ai_conversations.deleteMany({{user_id: '{self.user_id}'}});
        """
        
        try:
            import subprocess
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print("✅ Test data cleaned up")
            else:
                print(f"⚠️ Cleanup warning: {result.stderr}")
                
        except Exception as e:
            print(f"⚠️ Cleanup error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Do Her Better Backend API Tests")
        print(f"🎯 Testing against: {self.base_url}")
        
        # Setup
        if not self.create_test_user_session():
            print("❌ Failed to setup test environment")
            return False
        
        # Run tests in order
        tests = [
            self.test_auth_me,
            self.test_seed_resources,  # Seed resources first
            self.test_create_partner_profile,
            self.test_get_partner_profile,
            self.test_cycle_current,
            self.test_ai_chat,
            self.test_chat_history,
            self.test_resources,
            self.test_logout
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(test.__name__, False, f"Exception: {str(e)}")
        
        # Cleanup
        self.cleanup_test_data()
        
        # Results
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  - {failure['test']}: {failure['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = DoHerBetterAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())