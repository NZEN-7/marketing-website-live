# Runbook: thermaldawn.com off Wix, before 3 Nov 2026

*Web Designer, 27 Sep 2026, for the CTO's condition on the CEO's item 6.
Nothing here has been done. Every step marked **Nick** is Nick's: registrar
and DNS accounts, nameserver changes, the transfer and its payment.*

## What is moving, and what is not

- **The registration.** thermaldawn.com is registered through Wix and renews
  on **3 Nov 2026**. Transferring it out adds a year, so there is no
  double-payment.
- **The DNS zone.** It is served by Wix (`ns2`/`ns3.wixdns.net`). Once the
  domain leaves Wix, Wix stops answering for it, so the zone must already be
  live somewhere else before the transfer starts.
- **Not the website.** It is already on Vercel: the apex A record and the
  `www` CNAME point there, and Wix serves no page. Search Console needs
  nothing: same domain, same property. Do **not** use Change of Address.
- **Email is the only thing at real risk.** Google Workspace mail for
  thermaldawn.com depends on the MX, SPF, DKIM and DMARC records below. Lose
  them and company email stops, and so does the website's lead email, which is
  the system of record for every form (`api/lead.js`).

## The zone today (public DNS, read 27 Sep 2026 via 8.8.8.8)

Every one of these is carried across **unchanged**: same name, type and value.
No clean-up during the move. Pruning is a separate change, later.

| Name | Type | Value | What it is |
|---|---|---|---|
| `@` | MX 10 | `aspmx.l.google.com` | Google Workspace mail |
| `@` | MX 20 | `alt1.aspmx.l.google.com` | Google Workspace mail |
| `@` | MX 30 | `alt2.aspmx.l.google.com` | Google Workspace mail |
| `@` | MX 40 | `alt3.aspmx.l.google.com` | Google Workspace mail |
| `@` | MX 50 | `alt4.aspmx.l.google.com` | Google Workspace mail |
| `@` | TXT | `v=spf1 include:_spf.google.com ~all` | SPF |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | DMARC (monitor only) |
| `@` | TXT | `google-site-verification=QJQCffRiQJnP14PhkTFyZf98EQkY9CALFTw95WTBb-Y` | Google verification (Workspace / Search Console) |
| `k2._domainkey` | CNAME | `dkim2.mcsv.net` | DKIM for Mailchimp |
| `k3._domainkey` | CNAME | `dkim3.mcsv.net` | DKIM for Mailchimp |
| `s1._domainkey` | CNAME | `s1._domainkey.thermaldawn.com.s019.ascendbywix.com` | DKIM for Wix's email marketing (SendGrid) |
| `s2._domainkey` | CNAME | `s2._domainkey.thermaldawn.com.s019.ascendbywix.com` | DKIM for Wix's email marketing (SendGrid) |
| `@` | A | `76.76.21.21` | Vercel (apex, 308s to www) |
| `www` | CNAME | `cname.vercel-dns.com` | Vercel (canonical site) |

Also checked and **absent**: AAAA on the apex, CAA, `google._domainkey`.

**DKIM, read this before the move.** There is **no Google Workspace DKIM
record**. `google._domainkey` does not exist, so Workspace mail from
thermaldawn.com is not signed as thermaldawn.com today. The DKIM records that
do exist belong to Mailchimp and to Wix's email marketing. Carrying "every mail
record" therefore means carrying those four CNAMEs, and there is no Google DKIM
key to carry. Turning Google DKIM on is worth doing, but as its own change
**after** the move has settled, not during it. It is Admin console > Apps >
Google Workspace > Gmail > Authenticate email: generate, publish the TXT at
the new host, then start authentication. Tightening DMARC past `p=none` comes
after that.

**Public DNS is not the whole zone.** A lookup can only find names you know to
ask for. Step 1 exports what Wix actually holds; anything in it that isn't in
the table above is carried too.

## Choosing the new home (Nick decides)

Registrar and DNS host can be one account or two. The recommendation is
**Cloudflare Registrar with Cloudflare DNS**: at-cost .com renewal and a
DNS panel that shows every record plainly. Cloudflare only accepts a transfer
once the domain already uses its nameservers, which forces the safe order
below anyway. Two conditions apply on Cloudflare:

- Every record is **DNS only** (grey cloud), never proxied. Vercel issues its
  own certificate and needs to see the real traffic, and mail records can't
  be proxied at all.
- Don't accept Cloudflare's "import" blindly: it scans public DNS the same way
  the table above was built, and misses the same things. Compare it against
  the Wix export.

GoDaddy, where freevolt.com.au already sits (`ns77`/`ns78.domaincontrol.com`),
also works and keeps one account. The steps are the same.

## The order, and why

DNS moves first, **while the domain is still at Wix**, so the old zone stays
intact as a rollback. The registration moves second, only once mail has run
cleanly on the new nameservers.

### Stage 1: rebuild the zone (no risk; nothing live changes)

1. **Nick:** in Wix (Domains > thermaldawn.com > Manage DNS records), export
   or screenshot **every** record. Save it to Drive, in the CTO's folder, not
   in this repo. Diff it against the table above; add anything extra to the
   table.
2. **Nick:** create the zone at the new DNS host and enter every record,
   exactly. Keep the TTLs at 3600 or lower.
3. **Verify the new zone before it is live** by asking its nameservers
   directly. Every line must match the table (`NEW-NS` is one of the new
   host's nameservers):

   ```bash
   for q in "MX thermaldawn.com" "TXT thermaldawn.com" "TXT _dmarc.thermaldawn.com" "CNAME k2._domainkey.thermaldawn.com" "CNAME k3._domainkey.thermaldawn.com" "CNAME s1._domainkey.thermaldawn.com" "CNAME s2._domainkey.thermaldawn.com" "A thermaldawn.com" "CNAME www.thermaldawn.com"; do set -- $q; echo "== $1 $2"; dig +short "$2" "$1" @NEW-NS; done
   ```

   Windows alternative: `Resolve-DnsName thermaldawn.com -Type MX -Server NEW-NS`.
   Anything missing or different stops the run here.

### Stage 2: change the nameservers (the one moment email is at risk)

4. **Pick the day:** a Tuesday to Thursday morning, AEST, with Nick reachable
   for 48 hours. **Not during the week Sales sends the holder notes (target
   11 Oct)**, because a lost reply there costs a customer. Proposed: **Tue
   13 Oct**.
5. **Nick:** at Wix, set the nameservers to the new host's. Do not delete
   anything in the Wix zone; it is the rollback.
6. **Watch:** the `.com` delegation caches for up to 48 hours, so for that
   long some resolvers get Wix and some the new host. Because the records are
   identical, either answer delivers mail. That is the reason for stage 1.
   - `dig NS thermaldawn.com @8.8.8.8` and `@1.1.1.1` until both show the new host.
   - Send mail **to** nickz@ from an outside address (Gmail personal) and
     reply **from** it; check the reply's headers show `spf=pass`.
   - Submit the website contact form once with test values; the notification
     arrives and the CRM capture picks it up.
   - https://www.thermaldawn.com and the apex both load (apex 308s to www).
7. **Rollback, if mail fails:** set the nameservers back to
   `ns2.wixdns.net` / `ns3.wixdns.net`. Mail recovers as caches expire (hours,
   not days, because the Wix zone was never touched).

### Stage 3: transfer the registration (after 48 quiet hours)

8. **Nick:** at Wix, turn off the transfer lock, get the authorisation (EPP)
   code, and make sure the registrant email is one Nick receives (the
   approval mail goes there).
9. **Nick:** start the transfer at the new registrar and pay (it includes the
   extra year). Approve the confirmation emails.
10. It takes up to 5 to 7 days. The nameservers don't change during a
    transfer, so nothing should blip. Re-run the stage 2 checks when it
    completes.
11. **Deadline:** start by **Fri 16 Oct**, so it completes before about
    24 Oct with a week in hand before the 3 Nov renewal. If it is still
    pending near 3 Nov, ask Wix not to auto-renew rather than cancelling
    anything.

### Afterwards (separate changes, not this runbook)

- Turn on Google Workspace DKIM (above), then consider DMARC `p=quarantine`.
- Decide whether the Wix email-marketing DKIM (`s1`, `s2`) and Mailchimp's
  (`k2`, `k3`) are still used; remove only what nothing sends with.
- freevolt.com.au (GoDaddy DNS, apex already on Vercel) should redirect to
  thermaldawn.com, set in Vercel's domain settings (see CLAUDE.md).
- Update CLAUDE.md's Domains section: registrar, DNS host, and that the
  Wix zone is gone.

## Not in this runbook

No website code changes. Canonicals, sitemap, robots, `vercel.json` and
`netlify.toml` already say `https://www.thermaldawn.com`, and none of that
depends on who hosts DNS.
