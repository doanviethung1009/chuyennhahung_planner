"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/planner/field";
import { filterUsers, type RoleFilter, type StatusView } from "./filter-users";
import { ADMIN_ROLES, assignableRoles, type AccountAction, type AccountImpact, type AdminRole, type AdminUser, type CredentialAction } from "./types";

interface Props {
  users: AdminUser[];
  currentUserId: string;
  actorRole: AdminRole;
  /** Resolves when the server has answered, success or not. */
  onSaveRole: (user: AdminUser, role: AdminRole) => Promise<void>;
  onReset: (user: AdminUser) => Promise<void>;
  onAccount: (user: AdminUser, kind: AccountAction, confirmHandle?: string) => Promise<void>;
  onCredential: (user: AdminUser, kind: CredentialAction) => Promise<void>;
  /** Total accounts on the server, and whether more pages remain (P07-12). */
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Counts what a permanent delete would remove; null when it could not be read. */
  onLoadImpact: (user: AdminUser) => Promise<AccountImpact | null>;
}

type ConfirmKind = "reset" | AccountAction | CredentialAction;

export function UserTable({
  users,
  currentUserId,
  actorRole,
  onSaveRole,
  onReset,
  onAccount,
  onCredential,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  onLoadImpact,
}: Props) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const format = useFormatter();
  const [drafts, setDrafts] = useState<Record<string, AdminRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: ConfirmKind } | null>(null);
  const [impact, setImpact] = useState<AccountImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [view, setView] = useState<StatusView>("active");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const visible = filterUsers(users, query, roleFilter, view);
  const deletedCount = users.filter((user) => user.deletedAt).length;
  const filtering = query.trim() !== "" || roleFilter !== "all";

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
      setConfirm(null);
      setImpact(null);
      setTyped("");
    }
  }

  async function ask(user: AdminUser, kind: ConfirmKind) {
    setTyped("");
    setImpact(null);
    if (kind !== "purge") return setConfirm({ id: user.id, kind });
    setBusyId(user.id);
    const counted = await onLoadImpact(user);
    setBusyId(null);
    // Without the numbers the confirmation cannot say what is lost: do not open it.
    if (counted) {
      setImpact(counted);
      setConfirm({ id: user.id, kind });
    }
  }

  return (
    <div className="grid gap-3">
      <div role="group" aria-label={t("viewLabel")} className="flex flex-wrap gap-2">
        {(["active", "deleted"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={buttonClass({ variant: view === value ? "primary" : "secondary", size: "sm" })}
          >
            {value === "active" ? t("viewActive") : t("viewDeleted", { count: deletedCount })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label
            htmlFor="admin-user-search"
            className="block text-sm font-medium text-foreground"
          >
            {t("searchLabel")}
          </label>
          <input
            id="admin-user-search"
            type="search"
            className={`${inputClass} mt-1.5`}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="admin-user-role-filter"
            className="block text-sm font-medium text-foreground"
          >
            {t("filterRoleLabel")}
          </label>
          <select
            id="admin-user-role-filter"
            className={`${inputClass} mt-1.5 w-auto`}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">{t("filterRoleAll")}</option>
            {ADMIN_ROLES.map((value) => (
              <option key={value} value={value}>
                {tr(value)}
              </option>
            ))}
          </select>
        </div>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRoleFilter("all");
            }}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            {t("filterClear")}
          </button>
        ) : null}
      </div>
      <p role="status" className="text-sm text-foreground-muted">
        {filtering
          ? t("filterResult", { shown: visible.length, total: users.length })
          : null}
      </p>
      {filtering && hasMore ? (
        <p className="text-sm text-foreground-muted">{t("filterPartial")}</p>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-base text-foreground-muted">{t("filterEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[56rem] border-collapse text-left text-base">
            <caption className="sr-only">{t("caption")}</caption>
            <thead className="bg-surface-muted text-sm text-foreground">
              <tr>
                {(
                  [
                    "colHandle",
                    "colName",
                    "colEmail",
                    "colRole",
                    "colCreated",
                    "colActions",
                  ] as const
                ).map((key) => (
                  <th key={key} scope="col" className="px-4 py-3 font-medium">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const role = user.role ?? "member";
                const draft = drafts[user.id] ?? role;
                const isSelf = user.id === currentUserId;
                // ADR 0017: an admin does not touch admin or super admin accounts.
                const manageable = assignableRoles(actorRole).includes(role);
                const busy = busyId === user.id;
                // A banned or deleted account keeps its role until it is unbanned / restored.
                const disabled = Boolean(user.bannedAt || user.deletedAt);
                const needsTyping = confirm?.kind === "purge" && Boolean(impact && (impact.trips > 0 || impact.reviews > 0));
                return (
                  <tr
                    key={user.id}
                    className="border-t border-border-subtle align-top"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-foreground"
                    >
                      <span className="break-all">{user.handle}</span>
                      {user.deletedAt || user.bannedAt ? (
                        <span className="ml-2 rounded-pill bg-surface-muted px-2 py-0.5 text-xs text-primary-strong">
                          {t(user.deletedAt ? "statusDeleted" : "statusBanned")}
                        </span>
                      ) : null}
                      {isSelf ? (
                        <span className="ml-2 rounded-pill bg-surface-muted px-2 py-0.5 text-xs text-primary-strong">
                          {t("you")}
                        </span>
                      ) : null}
                    </th>
                    <td className="px-4 py-3 text-foreground">
                      {user.displayName}
                    </td>
                    <td className="px-4 py-3 break-all text-foreground-muted">
                      {user.email || t("noEmail")}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf || !manageable || disabled ? (
                        <>
                          <span className="text-foreground">{tr(role)}</span>
                          {isSelf ? (
                            <p className="mt-1 max-w-48 text-sm text-foreground-muted">
                              {t("selfNote")}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={t("roleSelect", {
                              handle: user.handle,
                            })}
                            className={`${inputClass} w-auto`}
                            value={draft}
                            disabled={busy}
                            onChange={(e) =>
                              setDrafts({
                                ...drafts,
                                [user.id]: e.target.value as AdminRole,
                              })
                            }
                          >
                            {assignableRoles(actorRole).map((value) => (
                              <option key={value} value={value}>
                                {tr(value)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy || draft === role}
                            onClick={() =>
                              run(user.id, () => onSaveRole(user, draft))
                            }
                            className={buttonClass({
                              variant: "secondary",
                              size: "sm",
                            })}
                          >
                            {busy ? t("saving") : t("saveRole")}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                      <time dateTime={user.createdAt}>
                        {format.dateTime(new Date(user.createdAt), {
                          dateStyle: "medium",
                        })}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf || !manageable ? null : confirm?.id === user.id ? (
                        <div role="group" aria-label={t(confirm.kind)} className="grid max-w-64 gap-2">
                          <p className="text-sm text-foreground">
                            {confirm.kind === "purge" && impact && (impact.trips > 0 || impact.reviews > 0)
                              ? t("purgeImpact", { handle: user.handle, trips: impact.trips, reviews: impact.reviews })
                              : t(`${confirm.kind}Confirm`, { handle: user.handle })}
                          </p>
                          {needsTyping ? (
                            actorRole === "super_admin" ? (
                              <div>
                                <label htmlFor={`purge-type-${user.id}`} className="block text-sm font-medium text-foreground">
                                  {t("purgeTypeLabel", { handle: user.handle })}
                                </label>
                                <input
                                  id={`purge-type-${user.id}`}
                                  className={`${inputClass} mt-1.5`}
                                  value={typed}
                                  onChange={(e) => setTyped(e.target.value)}
                                  autoComplete="off"
                                />
                              </div>
                            ) : (
                              <p className="text-sm text-foreground-muted">{t("purgeSuperOnly")}</p>
                            )
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy || (needsTyping && (actorRole !== "super_admin" || typed !== user.handle))}
                              onClick={() =>
                                run(user.id, () =>
                                  confirm.kind === "reset"
                                    ? onReset(user)
                                    : confirm.kind === "rotateToken" || confirm.kind === "unlinkGoogle"
                                      ? onCredential(user, confirm.kind)
                                      : onAccount(user, confirm.kind, needsTyping ? typed : undefined),
                                )
                              }
                              className={buttonClass({ size: "sm" })}
                            >
                              {t(`${confirm.kind}Yes`)}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirm(null)}
                              className={buttonClass({ variant: "ghost", size: "sm" })}
                            >
                              {t("resetNo")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(user.deletedAt
                            ? (["restore", "purge"] as const)
                            : user.bannedAt
                              ? (["unban", "delete"] as const)
                              : ([
                                  "reset",
                                  "rotateToken",
                                  ...(user.hasGoogle ? (["unlinkGoogle"] as const) : []),
                                  "ban",
                                  "delete",
                                ] as const)
                          ).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              disabled={busy}
                              onClick={() => void ask(user, kind)}
                              className={buttonClass({ variant: "secondary", size: "sm" })}
                            >
                              {t(kind)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasMore ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            {loadingMore ? t("loadingMore") : t("loadMore")}
          </button>
          <p role="status" className="text-sm text-foreground-muted">
            {t("pageProgress", { loaded: users.length, total })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
