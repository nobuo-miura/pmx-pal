import path from "node:path";

/** 候補パスが基準ディレクトリ自身、またはその配下にあるかを判定します。 */
export function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}
