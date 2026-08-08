import asyncio
import auto_dream

async def main():
    print("Testing trigger_llm_compaction directly...")
    history = auto_dream.read_history()
    await auto_dream.trigger_llm_compaction(history)
    print("Test complete.")

if __name__ == "__main__":
    asyncio.run(main())
