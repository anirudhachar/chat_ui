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
      <p>{loadingText}</p>

      <style jsx>{`
        .chatSpinner {
          position: absolute;   /* ⬅ NOT fixed */
          inset: 0;
          background: rgba(51, 51, 51, 0.4);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 10;
        }

        .lineScale span {
          display: inline-block;
          width: 4px;
          height: 35px;
          margin: 0 3px;
          background: #fff;
          animation: scale 1s infinite ease-in-out;
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
          margin-top: 12px;
          font-size: 16px;
          color: white;
        }
      `}</style>
    </div>
  );
}
