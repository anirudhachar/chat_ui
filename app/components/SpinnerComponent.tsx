"use client";

export default function Spinner({ loadingText = "Loading..." }) {
  return (
    <div className="chatSpinner">
      <div className="lineScale">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p style={{color:"#9e9e9e"}}>{loadingText}</p>

    <style jsx>{`
  .chatSpinner {
    position: absolute;
    inset: 0;
  
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10;
  }

  .lineScale {
    display: flex;
    align-items: center;
  }

  .lineScale span {
    display: inline-block;
    width: 4px;
    height: 35px;
    margin: 0 3px;
    background: #9e9e9e;
    animation: scale 1s infinite ease-in-out;
  }

  /* 🔑 stagger animation like ngx-spinner */
  .lineScale span:nth-child(1) {
    animation-delay: -0.4s;
  }
  .lineScale span:nth-child(2) {
    animation-delay: -0.3s;
  }
  .lineScale span:nth-child(3) {
    animation-delay: -0.2s;
  }
  .lineScale span:nth-child(4) {
    animation-delay: -0.1s;
  }
  .lineScale span:nth-child(5) {
    animation-delay: 0s;
  }

  @keyframes scale {
    0%,
    100% {
      transform: scaleY(0.4);
      opacity: 0.6;
    }
    50% {
      transform: scaleY(1);
      opacity: 1;
    }
  }

  p {
    margin-top: 12px;
    font-size: 16px;
    color: white;
  }
`}</style>

    </div>
  );
}
