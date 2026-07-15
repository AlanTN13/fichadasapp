export default function LoadingSplash({ embedded = false }) {
  return (
    <div
      className={`loading-splash${embedded ? ' loading-splash--embedded' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando sistema de fichadas"
    >
      <div className="loading-splash__glow" aria-hidden="true" />
      <div className="loading-splash__content">
        <img
          className="loading-splash__logo"
          src="/nahuel-logo.png"
          alt="Lavadero Industrial Nahuel"
          decoding="async"
        />
        <p className="loading-splash__text">Cargando sistema de fichadas…</p>
        <span className="loading-splash__loader" aria-hidden="true" />
      </div>
    </div>
  );
}
