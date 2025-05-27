import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { parse } from 'https://deno.land/std@0.208.0/csv/parse.ts'
import re from 'https://deno.land/std@0.208.0/regex/mod.ts'

console.log("Iniciando configuração do cliente Supabase...")

// Configurar cliente Supabase com service_role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Variáveis de ambiente não encontradas", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  })
  throw new Error("Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias")
}

console.log("Criando cliente Supabase...")
const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
console.log("Cliente Supabase criado com sucesso")

console.log("upload_csv função iniciada")

// Funciona em requests POST multipart/form-data
Deno.serve(async (req) => {
  try {
    console.log("Nova requisição recebida:", {
      method: req.method,
      contentType: req.headers.get("content-type"),
      url: req.url
    })

    if (req.method !== "POST") {
      return new Response("Use POST", { status: 405 })
    }

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return new Response("Envie arquivo multipart/form-data", { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const user_id = formData.get("user_id") as string | null

    console.log("Dados do formulário recebidos:", {
      hasFile: !!file,
      fileName: file?.name,
      userId: user_id
    })

    if (!file || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing file or user_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fazer upload do arquivo para o bucket
    console.log("Iniciando upload do arquivo...")
    // Gerar nome único com timestamp
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${file.name}`

    // Depois use uniqueFileName no lugar de file.name no upload
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("uploads")
      .upload(`csv/${user_id}/${uniqueFileName}`, file.stream(), { contentType: file.type })

    if (uploadError) {
      console.error("Upload error:", { message: uploadError.message, details: uploadError })
      return new Response(JSON.stringify({ error: 'Failed to upload file', details: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log("Arquivo enviado com sucesso:", uploadData)

    // Ler o CSV
    console.log("Lendo conteúdo do CSV...")
    const csvText = await file.text()
    console.log("Conteúdo do CSV:", csvText)

    const rows = []
    const parsedData = parse(csvText, { skipFirstRow: true })
    console.log("Dados parseados:", parsedData)

    for (const row of parsedData) {
      const match = re.search(r'(\\d+)\\s*-\\s*([A-Z0-9\\s]+)\\s*-\\s*(\\d+)', row[0].strip())
      if (match) {
        codigo = match.group(1)
        nome_produto = match.group(2).strip()
        quantidade = int(match.group(3))
      }
      
      const valor = parseFloat(row[1])
      if (isNaN(valor)) continue
      
      rows.push({
        user_id,
        cfop: String(row[0]),
        valor: valor
      })
    }
    console.log('Rows to insert:', rows) // debug

    // Inserir no banco
    console.log("Iniciando inserção no banco...")
    const { error: insertError } = await supabaseAdmin
      .from("cfop_metrics")
      .insert(rows)

    if (insertError) {
      console.error("Insert error:", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      })
      return new Response(
        JSON.stringify({
          error: 'Failed to insert rows',
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log("Inserção concluída com sucesso")
    return new Response(JSON.stringify({ message: 'Success' }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Unexpected error:", {
      message: error.message,
      stack: error.stack,
    })
    return new Response(
      JSON.stringify({
        error: 'Unexpected error occurred',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
