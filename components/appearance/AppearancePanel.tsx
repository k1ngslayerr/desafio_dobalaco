"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Monitor, Moon, RotateCcw, Sun, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_APPEARANCE, normalizeHex } from "@/lib/appearance";
import { useAppearance } from "./AppearanceProvider";

function ColorField({ label, description, value, onChange, onValidity }: {
  label: string; description: string; value: string;
  onChange: (color: string) => void; onValidity: (valid: boolean) => void;
}) {
  const id = useId();
  const [buffer, setBuffer] = useState(value);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  function edit(text: string) {
    setBuffer(text);
    const normalized = normalizeHex(text);
    setInvalid(!normalized);
    onValidity(!!normalized);
    if (normalized) onChange(normalized);
  }
  return <div className="appearance-color-field">
    <div><label htmlFor={`${id}-hex`}>{label}</label><p id={`${id}-hint`}>{description}</p></div>
    <div className={`appearance-color-input ${invalid ? "invalid" : ""}`}>
      <input type="color" aria-label={`Escolher cor de ${label.toLowerCase()}`} value={value} onChange={(event) => { const color = event.target.value.toUpperCase(); setBuffer(color); setInvalid(false); onValidity(true); onChange(color); }} />
      <input id={`${id}-hex`} type="text" spellCheck={false} autoComplete="off" maxLength={7}
        aria-invalid={invalid} aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`}
        value={editing || invalid ? buffer : value} placeholder="#000000"
        onFocus={() => { setBuffer(value); setEditing(true); }}
        onChange={(event) => edit(event.target.value)}
        onBlur={() => { setEditing(false); const color = normalizeHex(buffer); if (color) { setBuffer(color); onChange(color); } }} />
      <span className="appearance-input-label">HEX</span>
    </div>
    {invalid && <p className="appearance-field-error" id={`${id}-error`}>Use 3 ou 6 dígitos hexadecimais, como #000000.</p>}
  </div>;
}

// Open/close remounts the fields: partial invalid input never leaks into a
// reopened panel, and cancelling always restores the last saved settings.
function PanelContents() {
  const { active, systemDark, preview, cancel, save } = useAppearance();
  const [validBackground, setValidBackground] = useState(true);
  const [validAccent, setValidAccent] = useState(true);
  const [fieldVersion, setFieldVersion] = useState(0);
  const background = active.mode === "system" ? (systemDark ? "#15181D" : "#F5F6F8") : active.background;
  const modes = [
    { name: "Sistema", icon: Monitor, background: null },
    { name: "Claro", icon: Sun, background: "#F5F6F8" },
    { name: "Escuro", icon: Moon, background: "#15181D" },
    { name: "Preto", icon: Moon, background: "#000000" },
  ];
  function resetFields() { setValidBackground(true); setValidAccent(true); setFieldVersion((old) => old + 1); }
  return <>
    <DialogHeader>
      <span className="appearance-heading-icon"><Sun size={23} strokeWidth={1.7} /></span>
      <DialogTitle>Do seu jeito.</DialogTitle>
      <DialogDescription>Escolha as cores que fazem você se sentir em casa.</DialogDescription>
    </DialogHeader>
    <div className="appearance-content">
      <fieldset className="appearance-modes"><legend>Ponto de partida</legend><div>
        {modes.map(({ name, icon: Icon, background: preset }) => {
          const selected = preset ? active.mode === "custom" && active.background === preset : active.mode === "system";
          return <button type="button" key={name} aria-pressed={selected} onClick={() => { preview({ ...active, mode: preset ? "custom" : "system", background: preset ?? active.background }); resetFields(); }}>
            <span className={`appearance-mode-sample sample-${name.toLowerCase()}`}><Icon size={18} />{selected && <span className="appearance-mode-check"><Check size={10} /></span>}</span><span>{name}</span>
          </button>;
        })}
      </div></fieldset>

      <div className="appearance-fields" key={fieldVersion}>
        <ColorField label="Fundo" description="A base de todas as suas telas." value={background} onValidity={setValidBackground}
          onChange={(color) => preview({ ...active, mode: "custom", background: color })} />
        <ColorField label="Acentuação" description="Botões, links e detalhes da interface." value={active.accent} onValidity={setValidAccent}
          onChange={(color) => preview({ ...active, accent: color })} />
      </div>

      <fieldset className="appearance-swatches"><legend>Experimente uma acentuação</legend><div>
        {["#3158CF", "#8B5CF6", "#00875A", "#F97316", "#E54477", "#00A6B6"].map((accent) => <button type="button" key={accent}
          style={{ backgroundColor: accent }} aria-label={`Acentuação ${accent}`} aria-pressed={active.accent === accent}
          onClick={() => { preview({ ...active, accent }); resetFields(); }}>{active.accent === accent && <Check size={15} color="var(--appearance-on-accent)" />}</button>)}
      </div></fieldset>

      <div className="appearance-live-preview" aria-label="Prévia das cores escolhidas">
        <div className="appearance-preview-top"><span className="appearance-preview-avatar">VI</span><div><strong>Seu próximo passo</strong><span>Movimente-se por 30 minutos</span></div><CheckCircle2 size={18} /></div>
        <div className="appearance-preview-progress"><span /></div>
        <div className="appearance-preview-bottom"><span><Zap size={14} />+100 XP</span><span className="appearance-preview-button">Fazer check-in<ArrowRight size={14} /></span></div>
      </div>
      <p className="appearance-help">A prévia já está aplicada ao site. Textos e superfícies se ajustam para manter o contraste.</p>
      <button type="button" className="appearance-reset" onClick={() => { preview({ ...DEFAULT_APPEARANCE }); resetFields(); }}><RotateCcw size={14} />Restaurar padrão</button>
    </div>
    <footer className="appearance-footer"><p><span className="appearance-status-dot" />Preferência deste navegador</p><div><button type="button" className="appearance-button secondary" onClick={cancel}>Cancelar</button><button type="button" className="appearance-button primary" disabled={!validBackground || !validAccent} onClick={save}><Check size={16} />Salvar aparência</button></div></footer>
  </>;
}

export function AppearancePanel() {
  const { open, cancel } = useAppearance();
  return <Dialog open={open} onOpenChange={(next) => { if (!next) cancel(); }}>
    <DialogContent className="appearance-dialog" aria-label="Personalizar aparência">
      {open && <PanelContents />}
    </DialogContent>
  </Dialog>;
}
