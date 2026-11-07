import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { useAuth } from "./lib/session";
import PasswordRecovery from "./pages/PasswordRecovery";
const CalendarPage = lazy(() => import("./pages/Calendar"));
const AssetQr = lazy(() => import('./pages/AssetQr'));
const AssetQrLabel = lazy(() => import('./pages/AssetQrLabel'));
const AssetProblems = lazy(() => import('./pages/AssetProblems'));
const AssetProblemDetails = lazy(() => import('./pages/AssetProblemDetails'));
const NewAssetProblem = lazy(() => import('./pages/NewAssetProblem'));
import { GoogleAccount } from "./components/GoogleAccount";
import { Brand, Button, PageHeading } from "./components/ui";
import { displayName, roleName } from "./lib/types";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Resources from "./pages/Resources";
import ResourceAvailability from "./pages/ResourceAvailability";
import MyRequests from "./pages/MyRequests";
import RequestDetails from "./pages/RequestDetails";
import CatalogManagement from "./pages/CatalogManagement";
import Accounts from "./pages/Accounts";
import Roles from "./pages/Roles";
import Audit from "./pages/Audit";
import Maintenance from "./pages/Maintenance";
import { canManage, type CatalogKind } from "./lib/catalog";

function Workspace() {
  const { user, signOut } = useAuth();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { pathname } = useLocation();
  const menuOpen = menuPath === pathname;
  useEffect(() => {
    const section = pathname.split("/")[1];
    const names: Record<string, string> = {
      "": "Overview",
      facilities: "Facilities",
      assets: "Assets",
      calendar: "Booking calendar",
      'asset-qr': 'Asset QR codes',
      'asset-problems': 'Asset problem reports',
      requests: "My requests",
      review: "Booking review",
      notifications: "Notifications",
      reports: "Reports",
      account: "My account",
      manage: "Catalog management",
      administration: "Access administration",
      audit: "Audit history",
      maintenance: "Maintenance management",
    };
    document.title = `${section === "requests" && pathname.split("/").length > 2 ? "Request details" : names[section] || "Page not found"} · CFABS`;
    document.getElementById("main-content")?.focus();
  }, [pathname]);
  if (!user) return <Navigate to="/login" replace />;
  const canReport = user.permissions.some((p) =>
    ["report.facility.view", "report.asset.view"].includes(p),
  );
  async function logout() {
    setPending(true);
    setError("");
    try {
      await signOut();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not sign out. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
          <Button
            variant="quiet"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuPath(menuOpen ? null : pathname)}
          >
            {menuOpen ? "Close" : "Menu"}
          </Button>
        </div>
        <div
          id="workspace-navigation"
          className={`sidebar-content ${menuOpen ? "is-open" : ""}`}
        >
          <p className="nav-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              <span aria-hidden="true">▦</span>Overview
            </NavLink>
            {user.permissions.includes("facility.view") && (
              <NavLink to="/facilities">
                <span aria-hidden="true">▥</span>Facilities
              </NavLink>
            )}
            {user.permissions.includes("asset.view") && (
              <NavLink to="/assets">
                <span aria-hidden="true">▧</span>Assets
              </NavLink>
            )}
            <NavLink to="/requests">
              <span aria-hidden="true">▤</span>My requests
            </NavLink>
            {user.permissions.includes('asset.view') && <NavLink to="/asset-qr"><span aria-hidden="true">▧</span>Scan an asset</NavLink>}
            <NavLink to="/asset-problems"><span aria-hidden="true">!</span>Asset problems</NavLink>
            {user.permissions.some((permission) => ["facility.view", "asset.view"].includes(permission)) && (
              <NavLink to="/calendar"><span aria-hidden="true">▦</span>Booking calendar</NavLink>
            )}
            {user.permissions.some((p) =>
              ["facility_booking.view_all", "asset_booking.view_all"].includes(
                p,
              ),
            ) && (
              <NavLink to="/review">
                <span aria-hidden="true">✓</span>Booking review
              </NavLink>
            )}
            <NavLink to="/notifications">
              <span aria-hidden="true">◷</span>Notifications
            </NavLink>
            {canReport && (
              <NavLink to="/reports">
                <span aria-hidden="true">▤</span>Reports
              </NavLink>
            )}
            {(
              [
                "departments",
                "facility-categories",
                "asset-categories",
                "facilities",
                "assets",
              ] as CatalogKind[]
            ).some((kind) => canManage(kind, user.permissions)) && (
              <NavLink to="/manage">
                <span aria-hidden="true">▥</span>Manage catalog
              </NavLink>
            )}
            {user.permissions.some((p) =>
              ["user.manage", "role.manage", "permission.manage"].includes(p),
            ) && (
              <NavLink to="/administration">
                <span aria-hidden="true">○</span>Access administration
              </NavLink>
            )}
            {user.permissions.some((p) => ["facility.maintenance.manage", "asset.maintenance.manage"].includes(p)) && (
              <NavLink to="/maintenance"><span aria-hidden="true">⚒</span>Maintenance</NavLink>
            )}
            {user.permissions.includes("audit.view") && <NavLink to="/audit"><span aria-hidden="true">▤</span>Audit history</NavLink>}
            <NavLink to="/account">
              <span aria-hidden="true">○</span>My account
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <p className="nav-label">CAMPUS TIME</p>
            <p>Asia/Manila · UTC+8</p>
            <div className="user-summary">
              <span className="avatar" aria-hidden="true">
                {displayName(user).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{displayName(user)}</strong>
                <span className="role-name">{roleName(user)}</span>
              </div>
            </div>
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            <Button
              variant="secondary"
              onClick={logout}
              disabled={pending}
              className="w-full"
            >
              {pending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <div className="workspace-topbar">
          <span>Campus Facility &amp; Asset Booking System</span>
          <span className="workspace-tag">Your workspace</span>
        </div>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          CFABS <span>All times shown in Philippine Standard Time</span>
        </footer>
      </div>
    </div>
  );
}

function Account() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeading eyebrow="Personal settings" title="My account">
        Your campus profile and current access.
      </PageHeading>
      <section className="surface profile">
        <h2>Profile details</h2>
        <dl>
          <dt>Name</dt>
          <dd>{displayName(user)}</dd>
          <dt>Username</dt>
          <dd>{user.username}</dd>
          <dt>Email address</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd className="role-name">{roleName(user)}</dd>
        </dl>
        <p className="muted">
          Contact your system administrator to update your account details or
          access.
        </p>
      </section>
      <GoogleAccount />
    </>
  );
}

function AdministrationRoute() {
  const { user } = useAuth();
  return (
    <Navigate
      to={
        user?.permissions.includes("user.manage")
          ? "/administration/accounts"
          : "/administration/roles"
      }
      replace
    />
  );
}

function CatalogRoute() {
  const { pathname } = useLocation();
  return <CatalogManagement key={pathname} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<PasswordRecovery key="request" mode="request" />} />
      <Route path="/reset-password" element={<PasswordRecovery key="confirm" mode="confirm" />} />
      <Route element={<Workspace />}>
        <Route index element={<Overview />} />
        <Route path="calendar" element={<Suspense fallback={<p role="status">Loading calendar…</p>}><CalendarPage /></Suspense>} />
        <Route
          path="facilities"
          element={<Resources key="facility" kind="facility" />}
        />
        <Route path="assets" element={<Resources key="asset" kind="asset" />} />
        <Route path="asset-qr" element={<Suspense fallback={<p role="status">Loading asset scanner…</p>}><AssetQr /></Suspense>} />
        <Route path="asset-problems" element={<Suspense fallback={<p role="status">Loading problem reports…</p>}><AssetProblems /></Suspense>} />
        <Route path="asset-problems/new" element={<Suspense fallback={<p role="status">Loading report form…</p>}><NewAssetProblem /></Suspense>} />
        <Route path="asset-problems/:id" element={<Suspense fallback={<p role="status">Loading problem report…</p>}><AssetProblemDetails /></Suspense>} />
        <Route path="asset-qr/:kind/:id" element={<Suspense fallback={<p role="status">Loading asset label…</p>}><AssetQrLabel /></Suspense>} />
        <Route
          path="facilities/:id"
          element={<ResourceAvailability key="facility" kind="facility" />}
        />
        <Route
          path="assets/:id"
          element={<ResourceAvailability key="asset" kind="asset" />}
        />
        <Route path="review" element={<MyRequests key="review" review />} />
        <Route path="review/:kind/:id" element={<RequestDetails review />} />
        <Route path="requests" element={<MyRequests key="mine" />} />
        <Route path="requests/:kind/:id" element={<RequestDetails />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="reports" element={<Reports />} />
        <Route path="manage" element={<CatalogRoute />} />
        <Route path="manage/:kind" element={<CatalogRoute />} />
        <Route path="manage/:kind/:assetId" element={<CatalogRoute />} />
        <Route path="administration" element={<AdministrationRoute />} />
        <Route path="administration/accounts" element={<Accounts />} />
        <Route path="administration/roles" element={<Roles />} />
        <Route path="maintenance" element={<Maintenance key="facility" kind="facility" />} />
        <Route path="maintenance/facility" element={<Maintenance key="facility" kind="facility" />} />
        <Route path="maintenance/asset" element={<Maintenance key="asset" kind="asset" />} />
        <Route path="audit" element={<Audit />} />
        <Route path="account" element={<Account />} />
        <Route
          path="*"
          element={
            <>
              <PageHeading
                eyebrow="Page not found"
                title="This page isn’t here."
              />
              <NavLink to="/">Return to overview</NavLink>
            </>
          }
        />
      </Route>
    </Routes>
  );
}
