import { app } from "electron";
import path from "path";

const ASSETS = "assets";

function html(fileName: string): string {
  return path.join(app.getAppPath(), ASSETS, "html", fileName);
}

export { html };
