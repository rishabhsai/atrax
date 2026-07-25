type ProductMarkProps = {
  type: "build" | "operate" | "vault" | "network";
};

export function ProductMark({ type }: ProductMarkProps) {
  if (type === "build") {
    return (
      <span className="product-mark mark-build" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (type === "operate") {
    return (
      <span className="product-mark mark-operate" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (type === "vault") {
    return (
      <span className="product-mark mark-vault" aria-hidden="true">
        <i />
      </span>
    );
  }

  return (
    <span className="product-mark mark-network" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function RunTrace() {
  return (
    <div className="run-trace" aria-label="Successful operational run">
      <div className="trace-meta">
        <span>RUN 8f3c7a24</span>
        <span>03:47.211</span>
      </div>
      <div className="trace-row">
        <span className="trace-step">01</span>
        <span className="trace-dot done" />
        <span>Load active accounts</span>
        <span>1.2s</span>
      </div>
      <div className="trace-row">
        <span className="trace-step">02</span>
        <span className="trace-dot done" />
        <span>Collect connected signals</span>
        <span>41.8s</span>
      </div>
      <div className="trace-row">
        <span className="trace-step">03</span>
        <span className="trace-dot done" />
        <span>Score customer risk</span>
        <span>18.4s</span>
      </div>
      <div className="trace-row">
        <span className="trace-step">04</span>
        <span className="trace-dot active" />
        <span>Publish new risks</span>
        <span>running</span>
      </div>
      <div className="trace-footer">
        <span>12 high-risk accounts</span>
        <span>$0.38</span>
      </div>
    </div>
  );
}

export function ToolNetwork() {
  return (
    <div className="tool-network" aria-label="Connected internal application tools">
      <div className="network-app network-app-main">
        <span className="network-tag">Operational app</span>
        <strong>Customer health</strong>
        <small>Calls 3 company tools</small>
      </div>
      <div className="network-line line-one" />
      <div className="network-line line-two" />
      <div className="network-line line-three" />
      <div className="network-app app-research">
        <span className="network-tag">Tool</span>
        <strong>Research.company</strong>
        <small>Read · approved</small>
      </div>
      <div className="network-app app-crm">
        <span className="network-tag">Vault grant</span>
        <strong>HubSpot.accounts</strong>
        <small>Read · 2 scopes</small>
      </div>
      <div className="network-app app-outreach">
        <span className="network-tag">Tool</span>
        <strong>Outreach.draft</strong>
        <small>Write · review required</small>
      </div>
      <div className="network-ledger">
        <span>Delegation trace</span>
        <p>maya → customer-health → outreach.draft</p>
        <strong>Allowed</strong>
      </div>
    </div>
  );
}

export function ProductDiagram({ type }: ProductMarkProps) {
  if (type === "build") {
    return (
      <div className="detail-diagram build-diagram">
        <div className="diagram-bar">
          <span>app/customer-brief</span>
          <span>production</span>
        </div>
        <div className="build-surface">
          <div className="mini-sidebar">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="mini-content">
            <span className="mini-label">Account brief</span>
            <strong>Northstar Labs</strong>
            <div className="mini-metric-row">
              <span>Health 84</span>
              <span>Renewal 42d</span>
              <span>Usage +18%</span>
            </div>
            <div className="mini-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <div className="diagram-runtime">
          <span>UI</span>
          <span>Server</span>
          <span>Data</span>
          <span>Auth</span>
          <span>Storage</span>
        </div>
      </div>
    );
  }

  if (type === "operate") {
    return (
      <div className="detail-diagram operate-diagram">
        <div className="diagram-bar">
          <span>runs / churn-monitor / 8f3c</span>
          <span className="success-text">live</span>
        </div>
        <RunTrace />
        <div className="approval-card">
          <span>Approval requested</span>
          <p>Send 3 account-review drafts to their owners?</p>
          <div>
            <button type="button">Reject</button>
            <button type="button">Approve</button>
          </div>
        </div>
      </div>
    );
  }

  if (type === "vault") {
    return (
      <div className="detail-diagram vault-diagram">
        <div className="diagram-bar">
          <span>vault / connections</span>
          <span>4 active</span>
        </div>
        <div className="connection-row">
          <span className="connection-icon">H</span>
          <div>
            <strong>HubSpot</strong>
            <small>Company CRM · connected by Maya</small>
          </div>
          <span className="connection-state">Healthy</span>
        </div>
        <div className="connection-row">
          <span className="connection-icon">S</span>
          <div>
            <strong>Slack</strong>
            <small>Acme workspace · 3 approved channels</small>
          </div>
          <span className="connection-state">Healthy</span>
        </div>
        <div className="grant-card">
          <span>Grant</span>
          <strong>customer-health → hubspot.accounts.read</strong>
          <small>Short-lived · production only · expires in 14m</small>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-diagram network-diagram">
      <div className="diagram-bar">
        <span>company tool registry</span>
        <span>18 tools</span>
      </div>
      <div className="registry-row">
        <span>01</span>
        <strong>Research.company</strong>
        <small>Research desk</small>
        <span>read</span>
      </div>
      <div className="registry-row selected">
        <span>02</span>
        <strong>Customer.brief</strong>
        <small>Customer health</small>
        <span>read</span>
      </div>
      <div className="registry-row">
        <span>03</span>
        <strong>Outreach.draft</strong>
        <small>Account workflow</small>
        <span>review</span>
      </div>
      <div className="tool-contract">
        <span>input</span>
        <code>{"{ accountId: string }"}</code>
        <span>output</span>
        <code>{"{ brief: Evidence[] }"}</code>
      </div>
    </div>
  );
}
