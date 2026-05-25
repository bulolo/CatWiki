// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

const LEGACY_PREFIX = "site_access_token"

function getSiteAccessTokenKey(tenantSlug: string, siteSlug: string) {
  return `${LEGACY_PREFIX}:${tenantSlug}:${siteSlug}`
}

export function getSiteAccessToken(tenantSlug?: string | null, siteSlug?: string | null) {
  if (typeof window === "undefined" || !tenantSlug || !siteSlug) return null

  const scopedToken = sessionStorage.getItem(getSiteAccessTokenKey(tenantSlug, siteSlug))
  if (scopedToken) return scopedToken

  return sessionStorage.getItem(`${LEGACY_PREFIX}:${siteSlug}`)
}

export function setSiteAccessToken(tenantSlug: string, siteSlug: string, token: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(getSiteAccessTokenKey(tenantSlug, siteSlug), token)
  sessionStorage.removeItem(`${LEGACY_PREFIX}:${siteSlug}`)
}

export function clearSiteAccessToken(tenantSlug: string, siteSlug: string) {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(getSiteAccessTokenKey(tenantSlug, siteSlug))
  sessionStorage.removeItem(`${LEGACY_PREFIX}:${siteSlug}`)
}

export function getCurrentRouteSiteAccessToken() {
  if (typeof window === "undefined") return null

  const [, tenantSlug, siteSlug] = window.location.pathname.split("/")
  return getSiteAccessToken(tenantSlug, siteSlug)
}
