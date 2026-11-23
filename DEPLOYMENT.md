# Deploy beyondknowledge.ch with GitHub Pages

**Do not change production DNS until the website review has been approved.** The files and workflow are prepared; this document distinguishes the preview from the production cutover. The contact email is confirmed as `info@beyondknowledge.ch`.

## 1. Create the repository and review deployment

GitHub CLI and authenticated GitHub access were not available in the implementation environment. Install [GitHub CLI](https://cli.github.com/) on a machine with normal network access, authenticate as an account allowed to create repositories in `bktlabs`, and run the commands from this project directory. Do not place tokens in files or command arguments.

```sh
gh auth login
gh auth status
git init -b main
git add .
git commit -m "Build Beyond Knowledge Technologies corporate website"
gh repo create bktlabs/beyondknowledge-website --public --source=. --remote=origin
```

If this folder already has its own Git history, skip `git init`; if it already has a commit, commit only pending changes. Check `git remote -v` before adding a remote. If the repository already exists, use that repository without overwriting it and add the prepared files on a branch for review. If a Sites source remote named `origin` exists, preserve it by renaming it to `sites-source` with `git remote rename origin sites-source` before the `gh repo create` command. An organization’s repository/Actions policy may require an owner to grant access. Public repositories support free Pages hosting; choose a private repository only with an eligible organization plan.

Before pushing, enable Pages with Actions through the API:

```sh
gh api --method POST repos/bktlabs/beyondknowledge-website/pages -f build_type=workflow
git push -u origin main
```

If GitHub requires a first branch before enabling Pages, push first, enable Pages, then rerun the workflow. If Pages is already enabled, set **Repository → Settings → Pages → Build and deployment → Source → GitHub Actions** or update it:

```sh
gh api --method PUT repos/bktlabs/beyondknowledge-website/pages -f build_type=workflow
gh workflow run pages.yml --repo bktlabs/beyondknowledge-website
gh run list --repo bktlabs/beyondknowledge-website --workflow pages.yml
```

Leave the **Custom domain** field empty and leave `SITE_MODE` unset during review. The workflow defaults to `preview`, with search indexing disabled and no custom-domain file. Verify the deployment at:

**https://bktlabs.github.io/beyondknowledge-website/**

This is the expected URL, not a claim that deployment has completed. If the organization’s `bktlabs.github.io` site already uses a custom domain, GitHub may route project sites under that inherited domain instead; check the actual `page_url` in the completed Actions run.

The **Build and deploy website** workflow checks content, builds the site, uploads only `dist/`, and deploys from `main`. Pull requests run checks/build only. Set the `github-pages` environment deployment branch policy to `main` in **Settings → Environments → github-pages**, if desired.

## 2. Review before changing DNS

Open the review URL on desktop and mobile. Check navigation, layout at narrow widths, zoom, contrast, keyboard focus, reduced motion, and contact links. Test that the confirmed mailbox receives email. Confirm all company wording and UID. Keep the existing site available through the review and cutover.

When approved:

```sh
gh variable set SITE_MODE --body production --repo bktlabs/beyondknowledge-website
gh workflow run pages.yml --repo bktlabs/beyondknowledge-website
```

Wait for a successful build/deploy before proceeding. Production adds indexable metadata, sitemap, robots, and `dist/CNAME` containing `beyondknowledge.ch`. **For an Actions-based Pages site, a CNAME file does not configure the domain setting; set it explicitly as described below.**

## 3. Find the authoritative DNS provider

Sign in to GoDaddy, open **Domain Portfolio**, select **beyondknowledge.ch**, then **DNS / Manage DNS**. Check **Nameservers** before editing records.

```sh
dig NS beyondknowledge.ch +short
```

If the authoritative nameservers belong to another provider, edit the active DNS zone there. GoDaddy registration does not imply that GoDaddy serves the domain’s DNS. Do not change nameservers solely to connect the website: that could disrupt email and other services.

Export or save the complete existing zone and current TTLs before editing. Record the old website targets for rollback. Keep email **MX**, SPF/DKIM/DMARC **TXT**, verification TXT, autodiscover and mail-related CNAMEs, and unrelated services intact. Check whether the mail service uses an A/AAAA address or SPF `a` mechanism tied to the apex before changing it; preserve mail-specific host records and resolve any such dependency with the mail provider.

## 4. Verify domain ownership in GitHub

After the review is approved, an organization owner should open **bktlabs → Settings → Pages → Add a domain**, enter `beyondknowledge.ch`, and follow GitHub’s TXT verification instructions. Use the exact host and token GitHub supplies, normally a host resembling `_github-pages-challenge-bktlabs`. Do not invent the token. Add it at the authoritative DNS provider and retain it after verification.

```sh
dig TXT _github-pages-challenge-bktlabs.beyondknowledge.ch +short
```

Return to GitHub and select **Verify**. This ownership verification is separate from the repository custom-domain setting. Do not verify a domain used by an unrelated GitHub site without checking its ownership and current use.

## 5. Configure the canonical domain in Pages

In **bktlabs/beyondknowledge-website → Settings → Pages → Custom domain**, enter **beyondknowledge.ch** and save. Use the apex domain to make it canonical. Alternatively:

```sh
gh api --method PUT repos/bktlabs/beyondknowledge-website/pages -f cname=beyondknowledge.ch
```

Configure this before directing production DNS to GitHub. The DNS check may initially fail until the next step. Do not set `www.beyondknowledge.ch` as the custom domain; with both hosts correctly configured, GitHub redirects `www` to the configured apex. Do not use GoDaddy domain forwarding for this setup.

## 6. Apply the reviewed GoDaddy DNS changes

Only after approval, open **Domain Portfolio → beyondknowledge.ch → DNS → DNS Records**. Use **Add New Record** or edit existing website records. At another authoritative provider use its equivalent DNS editor.

| Type | Host / Name | Value | TTL |
| --- | --- | --- | --- |
| A | @ | 185.199.108.153 | 600 seconds, or provider default |
| A | @ | 185.199.109.153 | 600 seconds, or provider default |
| A | @ | 185.199.110.153 | 600 seconds, or provider default |
| A | @ | 185.199.111.153 | 600 seconds, or provider default |
| CNAME | www | bktlabs.github.io | 600 seconds, or provider default |

The CNAME target has no `https://`, repository path, or trailing slash. `@` means the apex. Some editors display a final dot automatically. Use these four A records for IPv4. Remove stale conflicting apex website A/AAAA/ALIAS/ANAME records pointing to old hosting and the old `www` website record; replace GoDaddy parking/website-builder records and disable conflicting forwarding only for these website hosts. Preserve unrelated records. A CNAME cannot coexist with other records at the same `www` name.

If IPv6 is desired, add **all four** GitHub AAAA records instead of leaving old IPv6 targets:

```text
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

IPv6 is optional for this IPv4 setup; there must not be stale apex AAAA records serving a different website. Avoid wildcard DNS pointing to Pages. If a DNS proxy is in use, use DNS-only records for initial verification and certificate issuance.

## 7. Check propagation, HTTPS, and redirection

```sh
dig beyondknowledge.ch A +short
dig beyondknowledge.ch AAAA +short
dig www.beyondknowledge.ch CNAME +short
dig @1.1.1.1 beyondknowledge.ch A +short
dig @8.8.8.8 beyondknowledge.ch A +short
```

Expect the four IPv4 values above (order can differ) and `bktlabs.github.io.` for `www`. Query the authoritative server too if resolvers disagree: `dig @YOUR_AUTHORITATIVE_NS beyondknowledge.ch A`. DNS propagation can take up to 24 hours or longer depending on the previous TTL; changing TTL does not invalidate already cached values.

Return to **Settings → Pages**, wait for the successful DNS check and certificate issuance, and select **Enforce HTTPS** when available. Certificate availability may lag DNS verification. Never work around a certificate error by disabling browser checks.

```sh
curl -I https://beyondknowledge.ch/
curl -IL https://www.beyondknowledge.ch/
curl -IL http://beyondknowledge.ch/
curl -IL http://www.beyondknowledge.ch/
curl -I https://beyondknowledge.ch/assets/style.css
curl -I https://beyondknowledge.ch/assets/social.png
```

The apex HTTPS page and assets should return 200. Each `www`/HTTP variant should end at **https://beyondknowledge.ch/** with a valid certificate. Check the browser address bar, canonical tag, rendered site, mail link, `robots.txt`, and `sitemap.xml`. Ensure the production workflow ran after setting `SITE_MODE=production`. Future pushes to `main` automatically rebuild and publish.

## Troubleshooting and rollback

- **403 enabling Pages or creating the repo:** use an organization account with repository creation/admin rights, and check organization Actions policies and plan eligibility.
- **Actions failure:** inspect the failing step in the Actions tab. For “site not found,” enable the GitHub Actions publishing source. For deployment authorization errors, confirm `pages: write`, `id-token: write`, and environment protection rules. Confirm organization policy permits the official actions.
- **Preview 404:** wait for the deployment to succeed, use the repository path and trailing slash, and inspect `page_url`. Assets intentionally use relative paths, so they also work on project Pages.
- **DNS verification fails:** confirm authoritative nameservers, exact hosts/targets, no old IPv4/IPv6 values, no parking/forwarding, no proxy, and allow old TTLs to expire.
- **HTTPS unavailable:** inspect A/AAAA/CNAME and any restrictive CAA records. GitHub uses Let’s Encrypt; if CAA is present, allow `letsencrypt.org` while preserving authorizations needed by other services. Recheck after DNS propagation; certificate provisioning can take time.
- **Apex/www redirect is wrong:** configure the apex in repository Pages settings and both DNS hosts as above. Remove conflicting forwarding or old hosts. A CNAME alone does not implement HTTP redirection; GitHub provides it.
- **Email stops working:** restore any altered MX/TXT/mail host records from the zone backup and inspect dependencies on apex addresses. Website changes must preserve mail configuration.
- **Revert content:** revert the offending Git commit on `main`; the workflow republishes the prior source.
- **Rollback hosting:** restore the saved website A/AAAA/CNAME/forwarding values at the authoritative DNS provider and allow their TTLs to propagate. Keep email records unchanged. Once DNS no longer points to GitHub, adjust/remove the Pages custom-domain setting if abandoning Pages. Retain domain verification TXT.

## Official references

DNS targets and workflow requirements checked against official documentation on 23 November 2026. Recheck these before a future migration.

- [GitHub: Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: Verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub: Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [GoDaddy: Manage DNS records](https://www.godaddy.com/help/manage-dns-records-680)
