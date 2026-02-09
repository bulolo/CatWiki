import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from app.core.graph import create_agent_graph

# Mock settings
os.environ["OPENAI_API_KEY"] = "mock_key"
os.environ["OPENAI_API_BASE"] = "http://mock_url"

async def test_graph():
    print("Initializing Graph...")
    # Mock LLM that just returns a message (we can't easily mock the tool loop without a real API key or complex mocking, 
    # but we can check if graph builds and runs a single step if we mock the LLM response)
    
    # We'll use a real LLM instance but it will fail if no key. 
    # Actually, we should probably check if syntax is correct and graph compiles.
    
    try:
        # Just test graph compilation
        # We need a dummy model to pass to create_agent_graph
        llm = ChatOpenAI(api_key="sk-test", base_url="http://localhost:1234")
        graph = create_agent_graph(checkpointer=None, model=llm)
        print("Graph compiled successfully!")
        
        # Print graph structure
        print("Graph definition:")
        print(graph.get_graph().print_ascii())
        
    except Exception as e:
        print(f"Graph verification failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_graph())
