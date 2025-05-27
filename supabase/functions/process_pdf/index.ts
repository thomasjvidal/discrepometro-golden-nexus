import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

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

console.log("process_pdf função iniciada")

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
    const ano = formData.get("ano") as string | null

    console.log("Dados do formulário recebidos:", {
      hasFile: !!file,
      fileName: file?.name,
      userId: user_id,
      ano: ano
    })

    if (!file || !user_id || !ano) {
      return new Response(JSON.stringify({ error: 'Missing file, user_id or ano' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fazer upload do arquivo para o bucket
    console.log("Iniciando upload do arquivo...")
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${file.name}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("uploads")
      .upload(`pdf/${user_id}/${uniqueFileName}`, file.stream(), { contentType: file.type })

    if (uploadError) {
      console.error("Upload error:", { message: uploadError.message, details: uploadError })
      return new Response(JSON.stringify({ error: 'Failed to upload file', details: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log("Arquivo enviado com sucesso:", uploadData)

    // Processar o PDF
    console.log("Processando PDF...")
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer))
    const pages = pdfDoc.getPages()
    
    // Extrair dados do PDF
    console.log("Extraindo dados do PDF...")
    const produtos = []

    for (const page of pages) {
      const text = await page.getText()
      const linhas = text.split('\n').filter(line => line.trim())

      for (const linha of linhas) {
        // Ajuste o regex conforme o formato do seu PDF
        const match = linha.match(/Produto: (.+), Quantidade: (\d+)/)
        if (match) {
          produtos.push({
            user_id,
            produto: match[1].trim(),
            quantidade: parseInt(match[2]),
            ano: parseInt(ano)
          })
        }
      }
    }

    console.log("Dados extraídos:", produtos)

    // Inserir no banco
    console.log("Iniciando inserção no banco...")
    const { error: insertError } = await supabaseAdmin
      .from("inventarios")
      .insert(produtos)

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
    return new Response(JSON.stringify({ 
      message: 'Success',
      produtos: produtos
    }), {
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