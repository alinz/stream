import { Readable, Writable } from 'stream'

type DataInput = {
  headers: string[]
  data: { [key: string]: string }[]
}

const readAll = (input: Readable): Promise<string> => {
  let content = ''
  return new Promise((resolve, reject) => {
    input.on('data', (data) => {
      content += data
    })

    input.on('error', (err) => {
      reject(err)
    })

    input.on('end', () => {
      resolve(content)
    })
  })
}

const asyncWrite = (data: string, w: NodeJS.WritableStream) => {
  return new Promise((resolve, reject) => {
    w.write(data, (err) => {
      if (err) {
        reject(err)
        return
      }

      resolve()
    })
  })
}

export const write = async (input: Readable, output: NodeJS.WritableStream) => {
  const content = await readAll(input)

  const data = JSON.parse(content) as DataInput

  await asyncWrite(data.headers.join(','), output)

  for (const d of data.data) {
    await asyncWrite('\n', output)

    let firstItem = true
    for (const header of data.headers) {
      if (!firstItem) {
        await asyncWrite(',', output)
      }
      await asyncWrite(d[header], output)
      firstItem = false
    }
  }
}
