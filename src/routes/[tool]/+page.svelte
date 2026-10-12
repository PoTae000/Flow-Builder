<script lang="ts">
 let { data } = $props();
 const links = [{ slug: 'flowchart-online', name: 'Flowchart' }, { slug: 'dfd-online', name: 'DFD' }, { slug: 'er-diagram-online', name: 'ER Diagram' }];
</script>
<svelte:head>
 <title>{data.title} | Flow Builder</title>
 <meta name="description" content={data.description} />
 <link rel="canonical" href={`https://suepskun.online/${data.slug}`} />
 <meta property="og:type" content="website" />
 <meta property="og:title" content={`${data.title} | Flow Builder`} />
 <meta property="og:description" content={data.description} />
 <meta property="og:url" content={`https://suepskun.online/${data.slug}`} />
 <meta property="og:image" content="https://suepskun.online/og-image.png" />
 <meta property="og:locale" content="th_TH" />
</svelte:head>
<main class="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
 <article class="mx-auto max-w-3xl space-y-8">
  <a href="/" class="text-blue-400">Flow Builder</a>
  <header class="space-y-4"><h1 class="text-3xl font-bold leading-tight">{data.title}</h1><p class="text-lg leading-relaxed text-slate-300">{data.intro}</p></header>
  <a href="/" class="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">เปิดเครื่องมือสร้าง {data.name}</a>
  <section class="space-y-3"><h2 class="text-xl font-semibold">สัญลักษณ์ {data.name} ที่ใช้สร้างแผนภาพ</h2><ul class="list-disc space-y-3 pl-6">{#each data.items as item}<li>{item}</li>{/each}</ul></section>
  <section class="space-y-3"><h2 class="text-xl font-semibold">วิธีสร้าง {data.name} ออนไลน์</h2><ol class="list-decimal space-y-3 pl-6">{#each data.steps as step}<li>{step}</li>{/each}</ol></section>
  <p class="leading-relaxed text-slate-400">ใช้งานผ่านเบราว์เซอร์โดยไม่ต้องติดตั้งโปรแกรม เริ่มวาดแผนภาพด้วยโหมด Guest ได้ ส่วนฟีเจอร์ AI ต้องใช้แพ็กเกจ Pro</p>
  <nav aria-label="เครื่องมือแผนภาพอื่น" class="flex flex-wrap gap-5 border-t border-slate-700 pt-6">{#each links as link}{#if link.slug !== data.slug}<a href={`/${link.slug}`} class="text-blue-400">สร้าง {link.name} ออนไลน์</a>{/if}{/each}</nav>
 </article>
</main>
