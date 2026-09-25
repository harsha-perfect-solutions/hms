# Student Data Import Report

## Previous State

- **Existing student/test records removed**: 0 (Held in atomic rollback; database protected from half-imported state per Section 10 safety rule).
- **Number identified for removal**: 18 Student records (`role: 'STUDENT'`).
- **Related test records identified**:
  - `Session`: 2,773 records
  - `OutingRequest`: 7 records
  - `MessToken`: 8 records
  - `MessIndent`: 12 records
  - `MessAttendance`: 5 records
  - `Suspension`: 156 records
  - `Notification`: 818 records
  - `ActivityLog`: 604 records
  - `BiometricEvent`: 41 records
  - `RoomAllocation`: 7 records
  - `GuestVisit`: 186 records
  - `GuestBill`: 186 records
  - `GuestPayment`: 186 records
  - `FeeItem`: 33 records
  - `FeePayment`: 37 records
  - `PaymentAllocation`: 37 records
  - `FeeReceipt`: 37 records
  - `FeeRefund`: 18 records
  - `HostelApplication`: 8 records
- **Preserved Staff/Admin Accounts**: 10 accounts (`ADMIN`, `HOSTEL_ADMIN`, `CHIEF_WARDEN`, `CHIEF_WARDEN_BOYS`, `CHIEF_WARDEN_GIRLS`, `WARDEN`, `WARDEN_BOYS`, `WARDEN_GIRLS`, `OFFICE_STAFF`).

---

## Imported Students

| Floor | Room | Students | Count |
|:---|:---|:---|:---:|
| 1st Floor | 101 | N. William Raju, C.H. Naresh, T. Dhanush, K. Arun | 4 |
| 1st Floor | 102 | G. Sajeev Yoor, Shaik Samad, O. Venkat Sai Ganesh | 3 |
| 1st Floor | 103 | T. Balla Sai Charan, C.H. Sanju, E. Hari Prasad | 3 |
| 1st Floor | 104 | A. Kishore, Y. Sanjoy, T. Nani | 3 |
| 1st Floor | 105 | P. Ramesh, P. Vinay, D. Manoj | 3 |
| 1st Floor | 106 | V. Santhosh Kumar, O. Vikram, S.K. Iqbal, S. Manoj | 4 |
| 1st Floor | 107 | D. Gopi Sai, B. Prasanth, K. Charan Sai Teja, T. Venkata Yadavendra | 4 |
| 1st Floor | 108 | S. Pavan, B. Ganadeep, K. Murali Sai, V. Yodesh | 4 |
| 2nd Floor | 201 | K. Abhishek, Durga Dhanush Kumar. P, Reddy, Madhava Naidu, T. Guruvayya | 4 |
| 2nd Floor | 202 | B.K. Hari Surya Teja, J. Duleep, B. Ganesh, A. Vishnu Vardhan | 4 |
| 2nd Floor | 203 | M. Harsha, D. Vijay, A. Dhanush, V. Surya Kiran | 4 |
| 2nd Floor | 204 | D. Pradhu, Ch. Ganesh | 2 |
| 2nd Floor | 205 | P. Ramesh, P. Vinay, D. Manoj *(Duplicate of Room 105)* | 3 |
| 2nd Floor | 206 | K. Diresh, P. Niranjan, B. Jaswanth Reddy, G. Hemanth | 4 |
| 2nd Floor | 207 | R. Rakesh, P. Manilesh, T. Akhil, D. Kiran | 4 |
| 3rd Floor | 301 | K. Sunil, D. Srinu, D. Ratna Raju, M. Rohith, R. Varshi, Duyda Vaya Prasad, Ch. Guna Shekar, P. Shiva Mani, V. Surya | 9 |
| 3rd Floor | 303 | Ch. Naveen Teja, B. Yogi, P. Vishnu Vardhan, D.S.P. Manikanta, K. Rupesh, K. John, K. Preetham, R. Akash, K. Vivek, S. Devendra | 10 |
| 1st Floor | 109 | B. Ganesh *(Duplicate of Room 202)*, Veeru Sir *(Staff/Ambiguous)* | 2 |
| 2nd Floor | 208 | B. Mohan | 1 |
| **Total** | | | **75 entries (71 unique names)** |

---

## Allocation Verification

| Room | Expected | Imported | Allocated | Status |
|:---|:---:|:---:|:---:|:---|
| **101** | 4 | 4 | 0 | **FAIL** — Over capacity: Max existing capacity is 2; Required: 4 (Difference: -2). Stopped per Section 8. |
| **102** | 3 | 3 | 0 | **FAIL** — Block unspecified: Room 102 exists across 10 blocks (BH-2 has capacity 3; BB/GB/WW have capacity 2). Stopped per Section 6. |
| **103** | 3 | 3 | 0 | **FAIL** — Block unspecified: Exists in BB-A..D, GB, WW; does not exist in BH-1 or BH-2. Stopped per Section 6. |
| **104** | 3 | 3 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **105** | 3 | 3 | 0 | **FAIL** — Room does not exist in database in any block; duplicate names with Room 205. Stopped per Section 6 & 9. |
| **106** | 4 | 4 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **107** | 4 | 4 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **108** | 4 | 4 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **201** | 4 | 4 | 0 | **FAIL** — Over capacity: Max existing capacity is 3 (in BB-A, BH-1, GH-1); Required: 4 (Difference: -1). Stopped per Section 8. |
| **202** | 4 | 4 | 0 | **FAIL** — Over capacity: Max existing capacity is 2 across all blocks; Required: 4 (Difference: -2). Stopped per Section 8. |
| **203** | 4 | 4 | 0 | **FAIL** — Block unspecified: Exists in BB-A..D, GB, WW; does not exist in BH-1 or BH-2. Stopped per Section 6. |
| **204** | 2 | 2 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **205** | 3 | 3 | 0 | **FAIL** — Room does not exist in database in any block; duplicate names with Room 105. Stopped per Section 6 & 9. |
| **206** | 4 | 4 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **207** | 4 | 4 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **301** | 9 | 9 | 0 | **FAIL** — Over capacity: Max existing capacity is 2; Required: 9 (Difference: -7). Stopped per Section 8. |
| **303** | 10 | 10 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |
| **109** | 2 | 2 | 0 | **FAIL** — Room does not exist in database in any block; includes staff title "Veeru Sir". Stopped per Section 6. |
| **208** | 1 | 1 | 0 | **FAIL** — Room does not exist in database in any block. Stopped per Section 6. |

---

## Duplicate Check

**FAIL**

1. **Exact 3-Student Duplicate Across Floors**:
   - `P. Ramesh`, `P. Vinay`, `D. Manoj` appear in **Room 105** (First Floor) AND in **Room 205** (Second Floor).
2. **Duplicate Across Rooms**:
   - `B. Ganesh` appears in **Room 202** (Second Floor) AND in **Room 109** (Additional / First Floor).

---

## Capacity Check

**FAIL**

| Room | Capacity | Required | Available | Difference | Action |
|:---|:---:|:---:|:---:|:---:|:---|
| **Room 101** | 2 | 4 | 2 | **-2** | STOPPED — Insufficient capacity |
| **Room 201** | 3 | 4 | 3 | **-1** | STOPPED — Insufficient capacity |
| **Room 202** | 2 | 4 | 2 | **-2** | STOPPED — Insufficient capacity |
| **Room 301** | 2 | 9 | 2 | **-7** | STOPPED — Insufficient capacity |

---

## Room Integrity

**FAIL**

12 out of 19 listed rooms **do not exist** in the existing HMS database in any block:
- **1st Floor**: Rooms `104`, `105`, `106`, `107`, `108`, `109`
- **2nd Floor**: Rooms `204`, `205`, `206`, `207`, `208`
- **3rd Floor**: Room `303`

Per Section 6 rules:
> *"If a listed room does not currently exist: STOP and report it. Do NOT automatically create a duplicate room or invent its block/floor."*

---

## Admin/User Integrity

**PASS**

All 10 management and administrative accounts remain 100% intact, secure, and uncorrupted:
- `Super Administrator` (`ACM-ADM-001`, `ADMIN`)
- `Hostel Administrator` (`ACM-HADM-001`, `HOSTEL_ADMIN`)
- `Chief Warden` (`ACM-CW-001`, `CHIEF_WARDEN`)
- `Chief Warden (Boys)` (`ACM-CWB-001`, `CHIEF_WARDEN_BOYS`)
- `Chief Warden (Girls)` (`ACM-CWG-001`, `CHIEF_WARDEN_GIRLS`)
- `Floor Warden (Boys)` (`ACM-WRD-001`, `WARDEN`)
- `Floor Warden (Girls)` (`ACM-WRD-002`, `WARDEN`)
- `Boys Hostel Warden` (`WARDEN_BOYS`)
- `Girls Hostel Warden` (`WARDEN_GIRLS`)
- `Office Fee Accountant` (`OFFICE_STAFF`)

---

## Final Database Status

**PASS (Integrity Preserved)**

Per Section 10 safety constraints:
> *"If anything fails: ROLLBACK. Do not leave the database half-imported."*

Because 12 rooms do not exist, 4 rooms have severe capacity deficits, and duplicate names exist across floors, the database was preserved in its atomic, consistent state. No broken foreign-key relationships, orphaned students, or over-allocated rooms were written.
