async function testApi() {
  try {
    const res = await fetch("http://localhost:4000/api/mkt-members");
    const json = await res.json();
    console.log("GET /api/mkt-members:", json);

    const syncRes = await fetch("http://localhost:4000/sync/mkt", { method: "POST" });
    const syncJson = await syncRes.json();
    console.log("POST /sync/mkt:", syncJson);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testApi();
