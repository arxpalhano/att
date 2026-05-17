/**
 * DynamoDB helper — armazena estado mutável do portal (blocos, tickets, atividades).
 * Tabelas em us-east-1 (PAY_PER_REQUEST). Custo: ~$0 no free tier.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, ScanCommandOutput, PutCommand, DeleteCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.APP_AWS_REGION || "us-east-1";

let _doc: DynamoDBDocumentClient | null = null;
function getDoc(): DynamoDBDocumentClient {
  if (_doc) return _doc;
  const client = new DynamoDBClient({ region: REGION });
  _doc = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
  });
  return _doc;
}

export async function scanAll<T>(table: string): Promise<T[]> {
  const doc = getDoc();
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;
  do {
    const res: ScanCommandOutput = await doc.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey })
    );
    items.push(...((res.Items as T[]) || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function putItem<T extends { id: string }>(table: string, item: T): Promise<void> {
  await getDoc().send(new PutCommand({ TableName: table, Item: item }));
}

export async function deleteItem(table: string, id: string): Promise<void> {
  await getDoc().send(new DeleteCommand({ TableName: table, Key: { id } }));
}

/** Sobrescreve todo o conteúdo da tabela com a lista fornecida (idempotente). */
export async function replaceAll<T extends { id: string }>(table: string, items: T[]): Promise<void> {
  const doc = getDoc();
  // Batch write em chunks de 25 (limite DynamoDB)
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: chunk.map((item) => ({ PutRequest: { Item: item } })),
        },
      })
    );
  }
}

export const TABLES = {
  BLOCKS: "att-blocks",
  TICKETS: "att-tickets",
  ACTIVITIES: "att-activities",
} as const;
