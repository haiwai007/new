import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TemplateDoc } from "@/types/template.ts";

// Local persistence. Images are stored as Blobs in their own store and
// referenced by id from template JSON, keeping documents small.

export type AssetRecord = {
  id: string;
  name: string;
  blob: Blob;
  mime: string;
  size: number;
  width: number;
  height: number;
  category: string;
  /** "library" assets are visible in the asset panel; "internal" ones back templates. */
  scope: "library" | "internal";
  createdAt: string;
};

export type WorkKind = "project" | "template";

export type WorkRecord = {
  id: string;
  kind: WorkKind;
  name: string;
  doc: TemplateDoc;
  thumbnail: string | null;
  favorite: boolean;
  version: number;
  /** Local edit revision, independent of named history versions. Legacy records start at 0. */
  revision?: number;
  /** Where this work came from (built-in template id or custom template id). */
  origin: string | null;
  fromUpload: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VersionRecord = {
  id: string;
  workId: string;
  version: number;
  name: string;
  doc: TemplateDoc;
  createdAt: string;
  /** Optional user note, e.g. "定稿" (added later; older records lack it). */
  note?: string;
  /** Small preview data URL captured at save time. */
  thumbnail?: string | null;
  /** How the version was created. */
  reason?: "create" | "save" | "restore" | "import";
};

export type ExportRecord = {
  id: string;
  workId: string | null;
  workName: string;
  fileName: string;
  format: "png" | "jpeg";
  width: number;
  height: number;
  createdAt: string;
};

export type Schema = DBSchema & {
  assets: { key: string; value: AssetRecord; indexes: { by_created: string } };
  works: { key: string; value: WorkRecord; indexes: { by_updated: string } };
  versions: { key: string; value: VersionRecord; indexes: { by_work: string } };
  exports: {
    key: string;
    value: ExportRecord;
    indexes: { by_created: string };
  };
  kv: { key: string; value: unknown };
};

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("当前浏览器不支持本地存储（IndexedDB）"));
    }
    dbPromise = openDB<Schema>("caishen-studio", 1, {
      upgrade(db) {
        db.createObjectStore("assets", { keyPath: "id" }).createIndex(
          "by_created",
          "createdAt",
        );
        db.createObjectStore("works", { keyPath: "id" }).createIndex(
          "by_updated",
          "updatedAt",
        );
        db.createObjectStore("versions", { keyPath: "id" }).createIndex(
          "by_work",
          "workId",
        );
        db.createObjectStore("exports", { keyPath: "id" }).createIndex(
          "by_created",
          "createdAt",
        );
        db.createObjectStore("kv");
      },
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
