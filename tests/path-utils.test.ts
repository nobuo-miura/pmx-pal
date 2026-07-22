import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPathInside } from "../electron/path-utils";

describe("isPathInside", () => {
  const root = path.resolve("fixtures", "model");

  it("基準ディレクトリ自身と配下のファイルを許可する", () => {
    expect(isPathInside(root, root)).toBe(true);
    expect(isPathInside(root, path.join(root, "textures", "face.png"))).toBe(true);
    expect(isPathInside(root, path.join(root, "..texture.png"))).toBe(true);
  });

  it("親ディレクトリへの移動を拒否する", () => {
    expect(isPathInside(root, path.resolve(root, "..", "secret.txt"))).toBe(false);
  });

  it("名前の先頭が同じ兄弟ディレクトリを拒否する", () => {
    expect(isPathInside(root, `${root}-backup/file.png`)).toBe(false);
  });
});
