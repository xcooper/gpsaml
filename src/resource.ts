import { app } from "electron";
import path from "path";

const ASSETS = "assets";

function loadResource(fileName: string): string {
  return path.join(app.getAppPath(), ASSETS, fileName);
}

export { loadResource };
