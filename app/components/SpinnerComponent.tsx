"use client";

export default function Spinner({ loadingText = "Loading..." }) {
  return (
    <div className="spinnerOverlay">
      <div className="lineScale">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>{loadingText}</p>

      <style jsx>{`
        .spinnerOverlay {
          position: fixed;
          inset: 0;
          background: rgba(51, 51, 51, 0.8);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }

        .lineScale span {
          display: inline-block;
          width: 4px;
          height: 35px;
          margin: 0 3px;
          background: #fff;
          animation: scale 1s infinite ease-in-out;
        }

        .lineScale span:nth-child(2) {
          animation-delay: 0.1s;
        }
        .lineScale span:nth-child(3) {
          animation-delay: 0.2s;
        }
        .lineScale span:nth-child(4) {
          animation-delay: 0.3s;
        }
        .lineScale span:nth-child(5) {
          animation-delay: 0.4s;
        }

        @keyframes scale {
          0%,
          100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1);
          }
        }

        p {
          margin-top: 16px;
          font-size: 20px;
          color: white;
        }
      `}</style>
    </div>
  );
}
