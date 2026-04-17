# Black Hole Benchmark

> **WebGL 2.0 기반의 초고해상도 물리 렌더링 GPU 스트레스 테스트 도구**

<img width="100%" alt="image" src="https://i.imgur.com/2Gy8AaL.jpeg" />

## 1. 소개 (Introduction)

이 프로젝트는 웹 브라우저 환경에서 동작하는 고성능 GPU 벤치마크 및 시각화 시뮬레이터입니다.
단순 무의미한 연산이 아닌, 슈바르츠실트 계량(Schwarzschild Metric)에 기반한 실제 빛의 굴절(RK4 측지선 적분)을 연산하여 사용자에게 압도적인 가상 블랙홀 렌더링을 제공합니다.

**주요 기능**
- **4단계 스트레스 테스트**: 물리 연산 단계를 점진적으로 높여 프레임 드랍과 1% Low FPS, 편차를 측정합니다.
- **인터렉티브 3D 시각화**: 마우스 드래그를 통해 실시간으로 시공간이 휘어지는 3D 블랙홀(강착원반 및 X선 제트)을 다각도에서 감상할 수 있습니다. (여러분의 GPU 성능이 넉넉하다면 말이죠. 😏)
- **상세한 결과 리포트**: 벤치마크가 종료된 후, 시스템 로그 형식의 전문적인 결과창(Avg FPS, Variance, Spikes 등)을 출력하며 Recharts를 이용한 프레임 타임 분포도를 제공합니다.
- **최적화된 IDLE 모드**: 벤치마크 미실행 시에는 발열 방지를 위해 고강도 연산을 완전 중단하고 평화로운 우주 배경만을 출력합니다.

## 2. 기술 스택 (Tech Stack)

- **Frontend**: React (Vite), JavaScript (ES6+), Vanilla CSS
- **Graphics & Math**: WebGL 2.0 (GLSL Fragment Shader), 4th-order Runge-Kutta (RK4) integration
- **State Management**: Zustand
- **Visualization**: Recharts, Framer Motion

## 3. 설치 및 실행 (Quick Start)

**요구 사항**: Node.js 18.0 이상 권장

1. **설치 (Install)**
   ```bash
   git clone https://github.com/JTech-CO/Black-Hole-Benchmark.git
   cd Black-Hole-Benchmark
   npm install
   ```

2. **실행 (Run)**
   ```bash
   npm run dev
   ```

3. **빌드 (Build)**
   ```bash
   npm run build
   ```

## 4. 폴더 구조 (Structure)

```text
src/
├── assets/        # 정적 이미지 및 글로벌 CSS 리소스 (NASA 배경 등)
├── components/    # 기능별 React UI 컴포넌트 단위 분리
│   ├── features/  # HUD, ResultModal 등 핵심 기능 단위
│   ├── layout/    # OverlayContainer 등 레이아웃 구조
│   └── ui/        # CommandButton, DataLabel, GlassPanel 등 재사용 요소
├── engine/        # WebGL 렌더링 엔진 (BenchmarkLoop, WebGLContext)
├── store/         # Zustand 기반 글로벌 상태 관리
└── utils/         # 도메인 로직 및 측정/통계 유틸리티 함수
```

## 5. 정보 (Info)

- **License**: MIT
- **Space Background**: NASA Hubble Space Telescope
- **Black Hole Model**: Schwarzschild Metric (M=10M☉)
