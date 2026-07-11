import { ImageResponse } from "next/og";

export const runtime = "edge";

// PWA 앱 아이콘을 코드로 생성한다 (/icons/192, /icons/512).
// 별도 이미지 파일 없이 오션 네이비 그라데이션 + EH(eunha) 로고를 렌더링한다.
export async function GET(
  _req: Request,
  { params }: { params: { size: string } }
) {
  const size = Number(params.size) === 512 ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0A2540 0%, #0F4C75 55%, #0184CA 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: size * 0.34,
            fontWeight: 800,
            letterSpacing: -size * 0.01,
            lineHeight: 1,
          }}
        >
          EH
        </div>
        <div
          style={{
            marginTop: size * 0.06,
            width: size * 0.42,
            height: size * 0.045,
            borderRadius: size * 0.03,
            background: "#7dd3fc",
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
