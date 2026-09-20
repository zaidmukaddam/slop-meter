import { type IncomingMessage, type Server, createServer } from "node:http"
import { BREAKS_PAGE, LONG_PAGE, TEST_PAGE, THREAD_PAGE } from "./fixtures.ts"

export const PAGES_PORT = 8123
export const STUB_PORT = 3999
export const PAGES = `http://localhost:${PAGES_PORT}`
export const STUB_API = `http://localhost:${STUB_PORT}`

const STREAM_CHUNK_DELAY_MS = 40
const REWRITE_CHUNKS = [
  "AI now shapes ",
  "how people work. ",
  "It speeds up workflows ",
  "and helps teams do more.",
  "\n\nRemoved: r-001, r-003, r-035",
]

export type ApiLog = {
  feedback: string[]
  rewrite: string[]
}

export async function startPageServer(): Promise<Server> {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html")
    const url = request.url ?? ""
    response.end(
      url.startsWith("/long")
        ? LONG_PAGE
        : url.startsWith("/thread")
          ? THREAD_PAGE
          : url.startsWith("/breaks")
            ? BREAKS_PAGE
            : TEST_PAGE
    )
  })
  await listen(server, PAGES_PORT)
  return server
}

export async function startStubApi(log: ApiLog): Promise<Server> {
  const server = createServer(async (request, response) => {
    const body = await readBody(request)
    if (request.url === "/api/rewrite") {
      log.rewrite.push(body)
      response.setHeader("content-type", "text/plain; charset=utf-8")
      for (const chunk of REWRITE_CHUNKS) {
        response.write(chunk)
        await sleep(STREAM_CHUNK_DELAY_MS)
      }
      response.end()
    } else if (request.url === "/api/feedback") {
      log.feedback.push(body)
      response.end("{}")
    } else {
      response.statusCode = 404
      response.end()
    }
  })
  await listen(server, STUB_PORT)
  return server
}

export async function stopServer(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => resolve(body))
  })
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve) => server.listen(port, resolve))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
