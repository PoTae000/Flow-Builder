# Bug Fixes and Instructions

## Critical Fixes Applied

### 1. ✅ Fixed Groq API Model Error
**Issue**: Using non-existent model `meta-llama/llama-4-scout-17b-16e-instruct`
**Fix**: Changed to `llama-3.3-70b-versatile` in `src/routes/api/import/+server.ts:145`

### 2. ✅ Fixed Content Security Policy Violations
**Issue**: Cloudflare beacon and fonts blocked by CSP
**Fix**: Updated CSP in `src/hooks.server.ts` to allow:
- `static.cloudflareinsights.com` in script-src
- `cloudflareinsights.com` in connect-src
- `'self'` in font-src for local fonts

### 3. 🔧 Database Foreign Key Constraint (Requires Manual Action)

**Issue**: Deleting diagrams fails with error:
```
error: update or delete on table "diagrams" violates foreign key constraint
"diagram_versions_user_sub_diagram_id_fkey" on table "diagram_versions"
```

**Root Cause**: The foreign key constraint on `diagram_versions` table is missing `ON DELETE CASCADE`.

**Fix**: Run the SQL migration script:

```bash
# Connect to PostgreSQL
psql postgresql://postgres:admin112233@127.0.0.1:5432/erdiagram

# Or run the fix script
psql postgresql://postgres:admin112233@127.0.0.1:5432/erdiagram < fix-foreign-key.sql
```

The script will:
1. Drop the existing constraint
2. Recreate it with `ON DELETE CASCADE`
3. Allow diagrams to be deleted without errors

### 4. ⚠️ Stripe Configuration (Optional)

**Issue**: Stripe initialization error - missing API keys

**Current State**: Stripe keys are empty in `.env`:
```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
```

**Action Required** (only if you need Stripe):
1. Create a Stripe account at https://stripe.com
2. Get your API keys from Stripe Dashboard
3. Update `.env` file with your keys:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

If you don't need Stripe payments, you can ignore this error.

---

## Known Mobile UI Issues (Reported in Thai)

The following mobile issues need investigation:

### Chen Model Mode (โหมด Chen Model)
- ❌ Cannot move attributes on mobile
- **Location**: Chen model attribute dragging

### Flowchart Mode
- ❌ Cannot resize nodes on mobile
- **Location**: Flowchart node resizing

### Quiz Mode
- ❌ Cannot submit answers on mobile
- **Location**: Quiz answer submission

### SQL Visualizer Mode
- ❌ SELECT highlighting doesn't collapse
- ❌ Highlight persists after exiting SQL Visualizer mode
- **Location**: SQL Visualizer highlighting logic

### SQL DDL Import
- ❌ Doesn't create relationship lines after import
- **Location**: SQL DDL parser/import logic

---

## Immediate Next Steps

1. **Run Database Migration** (Critical):
   ```bash
   psql postgresql://postgres:admin112233@127.0.0.1:5432/erdiagram < fix-foreign-key.sql
   ```

2. **Restart Development Server**:
   ```bash
   npm run dev
   ```

3. **Test**:
   - Try deleting a diagram
   - Import an ER diagram from text/image
   - Check console for CSP errors (should be gone)

4. **Optional - Configure Stripe** (if needed for payments)

---

## Additional Notes

- The Groq API key is present and valid: `gsk_G6jU...`
- Database connection is working: `postgresql://postgres:admin112233@127.0.0.1:5432/erdiagram`
- Google OAuth is configured
- Signaling server for WebRTC: `wss://er-diagram-signaling.onrender.com`

---

## Files Modified

1. `src/routes/api/import/+server.ts` - Fixed Groq model name
2. `src/hooks.server.ts` - Updated CSP headers
3. `fix-foreign-key.sql` - Database migration script (new file)
