export const styles = (primaryColor: string) => `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

  .td-launcher{
    position:fixed;
    width:52px;height:52px;border-radius:50%;
    background:${primaryColor};color:#fff;
    border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 16px rgba(0,0,0,.22);
    transition:transform .15s ease,box-shadow .15s ease;
  }
  .td-launcher:hover{transform:scale(1.07);box-shadow:0 6px 20px rgba(0,0,0,.28);}

  .td-panel{
    position:fixed;
    width:340px;
    height:480px;
    border-radius:16px;
    background:#fff;
    box-shadow:0 8px 40px rgba(0,0,0,.18);
    display:flex;flex-direction:column;
    overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-size:14px;
    bottom:88px !important;
  }

  .td-header{
    padding:14px 16px;
    background:${primaryColor};
    color:#fff;
    display:flex;align-items:center;gap:10px;
    flex-shrink:0;
  }
  .td-header-avatar{
    width:34px;height:34px;border-radius:50%;
    background:rgba(255,255,255,.2);
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .td-header-title{font-weight:600;font-size:14px;line-height:1.2;}
  .td-header-sub{font-size:11px;opacity:.8;margin-top:1px;}

  .td-messages{
    flex:1;overflow-y:auto;padding:14px 12px;
    display:flex;flex-direction:column;gap:8px;
    background:#f7f7f8;
  }
  .td-messages::-webkit-scrollbar{width:4px;}
  .td-messages::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:2px;}

  .td-welcome{
    text-align:center;padding:20px 8px;color:#666;font-size:13px;
  }

  .td-msg{
    max-width:82%;display:flex;flex-direction:column;gap:2px;
  }
  .td-msg--bot{align-self:flex-start;}
  .td-msg--user{align-self:flex-end;}

  .td-msg-content{
    padding:8px 12px;border-radius:14px;
    line-height:1.45;white-space:pre-wrap;word-break:break-word;
  }
  .td-msg--bot .td-msg-content{
    background:#fff;color:#111;
    border-bottom-left-radius:4px;
    box-shadow:0 1px 3px rgba(0,0,0,.08);
  }
  .td-msg--user .td-msg-content{
    background:${primaryColor};color:#fff;
    border-bottom-right-radius:4px;
  }
  .td-msg-status{font-size:10px;color:#999;align-self:flex-end;}

  .td-typing{
    display:inline-flex;align-items:center;gap:4px;
    padding:10px 14px;border-radius:14px;border-bottom-left-radius:4px;
    background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);
  }
  .td-typing span{
    width:6px;height:6px;border-radius:50%;background:#aaa;
    display:inline-block;
    animation:td-bounce 1.2s ease-in-out infinite;
  }
  .td-typing span:nth-child(2){animation-delay:.2s;}
  .td-typing span:nth-child(3){animation-delay:.4s;}
  @keyframes td-bounce{0%,80%,100%{transform:scale(0.7);}40%{transform:scale(1.1);}}

  .td-input-row{
    display:flex;align-items:flex-end;gap:8px;
    padding:10px 12px;border-top:1px solid #eee;
    background:#fff;flex-shrink:0;
  }
  .td-input{
    flex:1;resize:none;border:1px solid #e0e0e0;border-radius:10px;
    padding:8px 10px;font-size:13px;font-family:inherit;
    outline:none;max-height:80px;line-height:1.4;
    transition:border-color .15s;
  }
  .td-input:focus{border-color:${primaryColor};}
  .td-input:disabled{background:#f5f5f5;cursor:not-allowed;}

  .td-send{
    width:34px;height:34px;border-radius:50%;flex-shrink:0;
    background:${primaryColor};color:#fff;border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    transition:opacity .15s;
  }
  .td-send:disabled{opacity:.4;cursor:not-allowed;}
  .td-send:not(:disabled):hover{opacity:.88;}

  .td-branding{
    text-align:center;font-size:10px;color:#bbb;
    padding:4px 0 6px;background:#fff;flex-shrink:0;
  }
`;
