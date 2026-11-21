import { Router } from "express";
import type { Response } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { addLiveClient, removeLiveClient } from "../../live/hub";

const router = Router();

router.get("/", authMiddleware, (req, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  req.socket.setTimeout(0);
  req.socket.setNoDelay?.(true);
  req.socket.setKeepAlive?.(true);

  const client = addLiveClient(res);
  const keep = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keep);
    }
  }, 20000);

  const close = () => {
    clearInterval(keep);
    removeLiveClient(client);
  };
  req.on("close", close);
  req.on("aborted", close);
  res.on("close", close);
});

export default router;
