import type { Response } from "express";

export type LiveScope =
  | "orders"
  | "kitchen"
  | "tables"
  | "notifications"
  | "inventory"
  | "catalog"
  | "users";

export type LivePayload = {
  scope: LiveScope;
  at: string;
};

type Client = {
  res: Response;
  write: (chunk: string) => void;
};

const clients = new Set<Client>();

const send = (client: Client, chunk: string) => {
  try {
    client.write(chunk);
  } catch {
    clients.delete(client);
  }
};

export const addLiveClient = (res: Response): Client => {
  const client: Client = {
    res,
    write: (chunk) => {
      res.write(chunk);
    },
  };
  clients.add(client);
  send(client, ": connected\n\n");
  return client;
};

export const removeLiveClient = (client: Client) => {
  clients.delete(client);
};

export const publishLive = (...scopes: LiveScope[]) => {
  const unique = [...new Set(scopes)];
  if (!unique.length || !clients.size) return;
  const at = new Date().toISOString();
  for (const scope of unique) {
    const payload: LivePayload = { scope, at };
    const chunk = `event: change\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...clients]) {
      send(client, chunk);
    }
  }
};

export const pingLiveClients = () => {
  for (const client of [...clients]) {
    send(client, ": ping\n\n");
  }
};
