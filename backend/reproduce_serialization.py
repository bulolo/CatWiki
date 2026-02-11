from app.schemas.system_config import AIConfigUpdate, ModelConfig
import json

def test_serialization():
    print("Testing ModelConfig serialization...")
    
    # 1. Test basic ModelConfig with explicit mode
    try:
        m1 = ModelConfig(
            provider="openai",
            model="gpt-4",
            apiKey="sk-...",
            baseUrl="https://api.openai.com",
            mode="platform"
        )
        print(f"ModelConfig(mode='platform') dump: {m1.model_dump(mode='json')}")
    except Exception as e:
        print(f"Error creating ModelConfig with mode='platform': {e}")

    # 2. Test basic ModelConfig with default mode
    try:
        m2 = ModelConfig(
            provider="openai",
            model="gpt-4",
            apiKey="sk-...",
            baseUrl="https://api.openai.com"
        )
        print(f"ModelConfig(default) dump: {m2.model_dump(mode='json')}")
    except Exception as e:
        print(f"Error creating ModelConfig with default mode: {e}")

    # 3. Test AIConfigUpdate
    try:
        update_data = {
            "chat": {
                "provider": "openai",
                "model": "gpt-4", 
                "apiKey": "sk-...",
                "baseUrl": "...",
                "mode": "platform"
            },
            "embedding": {
                "provider": "openai",
                "model": "text-embedding-3",
                "apiKey": "sk-...",
                "baseUrl": "..."
            },
            "rerank": {
                "provider": "cohere",
                "model": "rerank-english-v3.0",
                "apiKey": "sk-...",
                "baseUrl": "..."
            },
            "vl": {
                "provider": "openai",
                "model": "gpt-4-vision",
                "apiKey": "sk-...",
                "baseUrl": "..."
            }
        }
        
        ai_update = AIConfigUpdate(**update_data)
        dumped = ai_update.model_dump(mode='json')
        print(f"AIConfigUpdate dump (chat.mode): {dumped['chat'].get('mode')}")
        
        if 'mode' not in dumped['chat']:
            print("CRITICAL: 'mode' field is MISSING in AIConfigUpdate dump!")
        else:
            print("SUCCESS: 'mode' field is present.")
            
    except Exception as e:
        print(f"Error testing AIConfigUpdate: {e}")

if __name__ == "__main__":
    test_serialization()
