const assert = require("assert");

async function testMessApi() {
  console.log("=== Running Student Hostel Mess Tokens API Tests ===\n");

  const loginRes = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jntuNo: "25331A05H7", password: "Password@123" }),
  });
  const loginData = await loginRes.json();
  const manasviToken = loginData.token;

  const unauthRes = await fetch("http://localhost:5001/api/student/mess-tokens");
  if (unauthRes.status !== 401) throw new Error("Expected 401 but got " + unauthRes.status);
  console.log("[PASS] 1. Unauthenticated request rejected with 401");

  const authRes = await fetch("http://localhost:5001/api/student/mess-tokens", {
    headers: { Authorization: "Bearer " + manasviToken },
  });
  const authData = await authRes.json();
  if (authRes.status !== 200) throw new Error("Expected 200 but got " + authRes.status);
  if (authData.student.jntuNo !== "25331A05H7") throw new Error("Wrong jntuNo: " + authData.student.jntuNo);
  if (authData.today.summary.totalMeals !== 4) throw new Error("Expected 4 total meals");
  if (authData.today.summary.bookedCount !== 4) throw new Error("Expected 4 booked (PostgreSQL state), got " + authData.today.summary.bookedCount);
  if (authData.today.summary.remainingCount !== 0) throw new Error("Expected 0 remaining");

  const bfSlot = authData.today.mealSlots.find(s => s.mealType === "BREAKFAST");
  const lcSlot = authData.today.mealSlots.find(s => s.mealType === "LUNCH");
  const skSlot = authData.today.mealSlots.find(s => s.mealType === "SNACKS");
  const dnSlot = authData.today.mealSlots.find(s => s.mealType === "DINNER");
  if (bfSlot.status !== "BOOKED") throw new Error("Breakfast not BOOKED");
  if (lcSlot.status !== "BOOKED") throw new Error("Lunch not BOOKED");
  if (skSlot.status !== "BOOKED") throw new Error("Snacks not BOOKED");
  if (dnSlot.status !== "BOOKED") throw new Error("Dinner not BOOKED");

  console.log("[PASS] 2. All 4 meals BOOKED in PostgreSQL:", authData.today.summary);

  const dupRes = await fetch("http://localhost:5001/api/student/mess-tokens/book", {
    method: "POST",
    headers: { Authorization: "Bearer " + manasviToken, "Content-Type": "application/json" },
    body: JSON.stringify({ mealType: "BREAKFAST" }),
  });
  if (dupRes.status !== 409) throw new Error("Expected 409 for duplicate booking, got " + dupRes.status);
  console.log("[PASS] 3. Duplicate booking rejected with 409 Conflict");

  const [reqA, reqB] = await Promise.all([
    fetch("http://localhost:5001/api/student/mess-tokens/book", {
      method: "POST",
      headers: { Authorization: "Bearer " + manasviToken, "Content-Type": "application/json" },
      body: JSON.stringify({ mealType: "DINNER" }),
    }),
    fetch("http://localhost:5001/api/student/mess-tokens/book", {
      method: "POST",
      headers: { Authorization: "Bearer " + manasviToken, "Content-Type": "application/json" },
      body: JSON.stringify({ mealType: "DINNER" }),
    }),
  ]);
  if (reqA.status !== 409 || reqB.status !== 409) throw new Error("Both concurrent DINNER requests should 409");
  console.log("[PASS] 4. Concurrency protection: both duplicate requests rejected (409)");

  const idorRes = await fetch("http://localhost:5001/api/student/mess-tokens?studentId=FAKE&jntuNo=21A91A0501", {
    headers: { Authorization: "Bearer " + manasviToken },
  });
  const idorData = await idorRes.json();
  if (idorData.student.jntuNo !== "25331A05H7") throw new Error("IDOR protection failed");
  console.log("[PASS] 5. IDOR protected: Backend ignores injected query parameters");

  const rahulLogin = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jntuNo: "21A91A0501", password: "Password@123" }),
  });
  const rahulToken = (await rahulLogin.json()).token;
  const rahulRes = await fetch("http://localhost:5001/api/student/mess-tokens", {
    headers: { Authorization: "Bearer " + rahulToken },
  });
  const rahulData = await rahulRes.json();
  if (rahulData.today.summary.bookedCount !== 0) throw new Error("Rahul should have 0 booked tokens");
  console.log("[PASS] 6. Unallocated student has 0 booked tokens");

  console.log("\nAll Mess Tokens API Tests Passed Successfully!");
}

testMessApi().catch(err => { console.error("Test failed:", err.message); process.exit(1); });
