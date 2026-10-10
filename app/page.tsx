"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Language = { id: string; code: string; name_en: string; name_local: string | null };

export default function Home() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [languageId, setLanguageId] = useState("");
  const [region, setRegion] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [commercialConsent, setCommercialConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let client: ReturnType<typeof createClient>;
    try { client = createClient(); } catch { setMessage("Setup needed: add your Supabase URL and publishable key to .env.local."); setError(true); return; }
    client.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id, email: data.user.email } : null));
    client.from("languages").select("id,code,name_en,name_local").eq("is_active", true).order("name_en")
      .then(({ data, error: e }) => {
        if (e) { setMessage("Could not load languages. Check the Supabase connection and database policies."); setError(true); return; }
        const rows = (data ?? []) as Language[]; setLanguages(rows); if (rows[0]) setLanguageId(rows[0].id);
      });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function authSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      const client = createClient();
      const { data, error: authError } = await client.auth.signUp({ email, password, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined } });
      if (authError) throw authError;
      if (data.user && !data.session) setMessage("Account request created. Check your email to confirm, then sign in.");
      else if (data.user) setMessage("Account created. You can submit audio after signing in.");
      else setMessage("If registration is enabled, check your email for next steps.");
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "Could not create account."); }
    finally { setBusy(false); }
  }

  async function signIn() {
    setBusy(true); setMessage(""); setError(false);
    try {
      const { error: e } = await createClient().auth.signInWithPassword({ email, password });
      if (e) throw e; setMessage("Signed in successfully.");
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await createClient().auth.signOut(); setUser(null); setMessage("Signed out.");
  }

  async function submitAudio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setError(false);
    if (!user) { setError(true); setMessage("Create an account or sign in before submitting audio."); return; }
    if (!file) { setError(true); setMessage("Choose an audio file first."); return; }
    if (!languageId) { setError(true); setMessage("Select a language."); return; }
    if (!aiConsent) { setError(true); setMessage("AI training consent is required for this pilot dataset."); return; }
    setBusy(true);
    try {
      const client = createClient();
      const allowed = ["audio/mpeg","audio/mp3","audio/wav","audio/x-wav","audio/mp4","audio/m4a","audio/ogg","audio/webm"];
      if (file.size > 25 * 1024 * 1024) throw new Error("Please choose an audio file smaller than 25 MB.");
      if (file.type && !allowed.includes(file.type)) throw new Error("Supported formats: MP3, WAV, M4A, OGG, or WebM.");
      const { data: row, error: insertError } = await client.from("submissions").insert({
        contributor_id: user.id, language_id: languageId, audio_object_path: "pending",
        dialect_region: region.trim() || null, consent_for_ai_training: aiConsent,
        consent_for_commercial_use: commercialConsent, consent_given_at: new Date().toISOString(), status: "submitted"
      }).select("id").single();
      if (insertError) throw insertError;
      const path = user.id + "/" + row.id + "/" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { error: uploadError } = await client.storage.from("language-audio").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        await client.from("submissions").delete().eq("id", row.id);
        throw new Error("Audio upload failed. Storage may not be configured yet: " + uploadError.message);
      }
      const { error: updateError } = await client.from("submissions").update({ audio_object_path: path }).eq("id", row.id);
      if (updateError) throw new Error("Audio uploaded but submission metadata could not be updated. Contact the project administrator.");
      setMessage("Submission received. Your audio is private and awaiting review.");
      setFile(null); setRegion(""); setAiConsent(false); setCommercialConsent(false);
      const form = e.currentTarget; form.reset();
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "Submission failed."); }
    finally { setBusy(false); }
  }

  return <main>
    <header className="nav"><div className="shell" style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",gap:18}}><a href="#" className="brand" style={{textDecoration:"none",color:"inherit"}}><span className="brand-mark">አ</span><span>Ethiopian Languages<br/>Data factory</span></a><nav className="nav-links"><a href="#languages">Languages</a><a href="#workflow">How it works</a><a href="#contribute">Contribute</a>{user ? <button className="btn btn-outline" onClick={signOut}>Sign out</button> : <a className="btn btn-outline" href="#account">Sign in</a>}</nav></div></header>
    <section className="shell hero"><div><div className="eyebrow">Preserving voices · Building language technology</div><h1>Every Ethiopian voice <span>deserves to be heard.</span></h1><p className="lead">A community-powered platform to collect high-quality audio, accurate transcripts, and trusted translations for Ethiopia’s languages—with consent, care, and human review.</p><div className="hero-actions"><a className="btn btn-primary" href="#contribute">Contribute audio <span aria-hidden>↗</span></a><a className="btn btn-outline" href="#workflow">Explore the process</a></div><p className="small-note">Start with Kaffa, Wolaytta, and Sidama. Your recordings are not public by default.</p></div><div className="visual"><div className="visual-title">A living library of Ethiopian voices</div><div className="sound-bars" aria-label="Decorative audio waveform">{Array.from({length:49},(_,i)=><i key={i} style={{height:(12+Math.abs(Math.sin(i*1.31)*Math.cos(i*.37))*90)+"px"}} />)}</div><div className="float-card"><strong>Our first language communities</strong><div className="language-row"><span>ከፋ · Kaffa</span><span className="pill">Pilot</span></div><div className="language-row"><span>ወላይታ · Wolaytta</span><span className="pill">Pilot</span></div><div className="language-row"><span>ሲዳማ · Sidama</span><span className="pill">Pilot</span></div></div></div></section>
    <section id="languages" className="section shell"><div className="section-head"><div className="eyebrow">Our starting point</div><h2>Local languages. Global possibilities.</h2><p>Build better speech and language tools by helping communities create data that reflects how people really speak.</p></div><div className="cards"><article className="card"><div className="card-icon">◉</div><h3>Kaffa</h3><p>Help document everyday speech, local expressions, and regional pronunciation.</p></article><article className="card"><div className="card-icon">⌁</div><h3>Wolaytta</h3><p>Contribute clear recordings and carefully checked text from native speakers.</p></article><article className="card"><div className="card-icon">✳</div><h3>Sidama</h3><p>Help create useful, consent-based language resources for future AI systems.</p></article></div></section>
    <section id="workflow" className="section shell"><div className="section-head"><div className="eyebrow">Quality first</div><h2>From a voice recording to trusted data.</h2><p>Every item moves through a review process before it can be approved for a dataset.</p></div><div className="workflow"><div className="step"><h3>Record</h3><p>Choose a language and upload a clear audio clip with permission.</p></div><div className="step"><h3>Transcribe</h3><p>A speaker writes down the words as they were said.</p></div><div className="step"><h3>Translate</h3><p>Add an Amharic or English translation and check its meaning.</p></div><div className="step"><h3>Review</h3><p>Reviewers check sound, transcript, translation, and consent before approval.</p></div></div></section>
    <section id="contribute" className="section shell"><div className="section-head"><div className="eyebrow">Join the pilot</div><h2>Contribute a recording</h2><p>Create an account, choose a language, and submit a short recording. Please do not upload other people's voices unless they have given informed permission.</p></div><div className="panel"><div className="notice">Pilot status: submissions only work after the administrator configures the private <code>language-audio</code> storage bucket and its access policies. No recordings should be uploaded until this is configured.</div>
      <div id="account" className="auth"><h3>{user ? "You are signed in" : "Create an account or sign in"}</h3>{user ? <p>Signed in as <strong>{user.email}</strong></p> : <form onSubmit={authSubmit} className="form-grid"><div className="field full"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div><div className="field full"><label htmlFor="password">Password (at least 6 characters)</label><input id="password" type="password" autoComplete="current-password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></div><div className="full" style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn btn-primary" type="submit" disabled={busy}>Create account</button><button className="btn btn-outline" type="button" onClick={signIn} disabled={busy}>Sign in</button></div></form>}</div>
      <hr style={{border:0,borderTop:"1px solid var(--line)",margin:"28px 0"}}/>
      <form onSubmit={submitAudio} className="form-grid"><div className="field"><label htmlFor="language">Language</label><select id="language" value={languageId} onChange={e=>setLanguageId(e.target.value)} required><option value="">Choose language</option>{languages.map(l=><option key={l.id} value={l.id}>{l.name_en}{l.name_local ? " · "+l.name_local : ""}</option>)}</select></div><div className="field"><label htmlFor="region">Region / dialect (optional)</label><input id="region" value={region} onChange={e=>setRegion(e.target.value)} placeholder="Zone, town, or dialect"/></div><div className="field full"><label htmlFor="audio">Audio file (max 25 MB)</label><input id="audio" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" onChange={e=>setFile(e.target.files?.[0] ?? null)}/><span className="small-note">MP3, WAV, M4A, OGG, or WebM. Keep clips short and avoid background music.</span></div><div className="full checkline"><input id="ai-consent" type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/><label htmlFor="ai-consent">I confirm I recorded this audio or have the speaker’s informed permission, and I consent to this recording being stored and used for AI training under the project’s data-use terms. I understand I can contact the project team with questions.</label></div><div className="full checkline"><input id="commercial-consent" type="checkbox" checked={commercialConsent} onChange={e=>setCommercialConsent(e.target.checked)}/><label htmlFor="commercial-consent">I separately agree that this recording may be included in commercial AI/data products. This is optional; leave unchecked if you do not agree.</label></div><div className="full"><button className="btn btn-primary" type="submit" disabled={busy || !user}>{busy ? "Working…" : "Submit recording"}</button>{!user && <p className="small-note">Sign in first to submit. Storage policies must be configured before this form can accept recordings.</p>}</div></form>{message && <div role="status" className={"status"+(error?" error":"")}>{message}</div>}</div></section>
    <footer className="footer"><div className="shell"><strong>Ethiopian Languages Data factory</strong><p>Built to support community-led language preservation and responsible AI research. Only collect recordings with informed consent. Never upload confidential, sensitive, or third-party recordings without permission.</p><p>© {new Date().getFullYear()} Ethiopian Languages Data factory · Pilot release</p></div></footer>
  </main>;
}