import sys
import json
import asyncio
from openbb_cftc.models.cot import CftcCotFetcher, CftcCotQueryParams

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing ID"}))
        return
    try:
        query = CftcCotQueryParams(id=sys.argv[1], report_type="legacy")
        data = await CftcCotFetcher.aextract_data(query, {})
        transformed = CftcCotFetcher.transform_data(query, data)
        # return the first 10 for testing
        print(json.dumps([d.model_dump() for d in transformed[-10:]]))
    except Exception as e:
        import traceback
        print(json.dumps({"error": traceback.format_exc()}))

if __name__ == "__main__":
    asyncio.run(main())
