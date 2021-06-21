'use strict';

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

import {
  OrbitControls
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';

import {
  GLTFLoader
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/GLTFLoader.js';

import {
  EffectComposer
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/postprocessing/EffectComposer.js';

import {
  RenderPass
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/postprocessing/RenderPass.js';

import {
  ShaderPass
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/postprocessing/ShaderPass.js';

import {
  GUI
} from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';

function main() {
  // create WebGLRenderer
  const canvas = document.querySelector('#canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  // animate 함수가 배경용 씬과 배경용 카메라로 렌더러가 렌더하고 난 뒤, 물체용 씬과 물체용 카메라를 다음에 렌더러가 렌더함.
  // 이때 먼저 렌더한 배경용 씬의 컬러 버퍼를 지워주지 말라고 false를 지정해준거임.
  // 그러나 수정한 예제에서 물체용 씬과 물체용 카메라를 전달해서 렌더타겟에 렌더하는 RenderPass의 clear 옵션을 꺼버렸기 때문에
  // 굳이 renderer의 autoClearColor를 비활성화하지 않아도 되는거지. 왜? 수정한 예제에서는 WebGLRenderer 대신 EffectComposer가 렌더해주니까
  // renderer.autoClearColor = false;

  // 모델용 씬을 찍을 perspective camera 생성 
  const fov = 45;
  const aspect = 2;
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 10, 20);

  // create OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0); // OrbitControls에 의해 카메라가 움직일 때 카메라의 시선을 해당 좌표에 고정시킴
  controls.update(); // 값을 바꿔주면 항상 업데이트 메서드를 호출해줘야 함.

  // 2*2*2 identity(동일한, 즉 아무 변화가 없는) 3DLUT 를 만들려는데, WebGL1이 3D 텍스처를 지원하지 않으므로, 이를 펼친 4*2 2D 텍스처로 identity LUT를 생성해주는 함수
  const makeIdentityLutTexture = function () {
    // 형식화 배열로 4*2 텍스처에 들어가는 픽셀 컬러들을 할당해놓음.
    const identityLUT = new Uint8Array([
      0, 0, 0, 255, // black
      255, 0, 0, 255, // red
      0, 0, 255, 255, // blue
      255, 0, 255, 255, // magenta
      0, 255, 0, 255, // green
      255, 255, 0, 255, // yellow
      0, 255, 255, 255, // cyan
      255, 255, 255, 255, // white
    ]);

    return function (filter) {
      // DataTexture 메서드는 raw data(위에 Uint8Array로 만든 4*2 2D 텍스쳐 데이터), width, height을 받아서 텍스처를 생성함.
      // 이때, THREE.RGBAFormat 이라는 값으로 넘겨줘서 형식을 지정했기 때문에, 4*2 텍스처의 각 색상값이 알파값도 넣어준거임.
      const texture = new THREE.DataTexture(identityLUT, 4, 2, THREE.RGBAFormat);
      texture.minFilter = filter;
      texture.magFilter = filter; // 만들어진 텍스처가 원본보다 각각 커질때, 작아질 때 전달받은 filter로 처리해 달라는 뜻.
      texture.needsUpdate = true; // 업데이트를 트리거할 설정을 해준 것. 나중에 이 텍스쳐가 사용되면 업데이트가 실행됨.
      texture.flipY = false; // false로 지정해서 만들어진 텍스처가 수직으로 뒤집어지지 않게 함.
      return texture;
    };
  }(); // 마지막에 달아주는 (); 는 뭐냐면, makeIndentityLutTexture에 리턴된 중첩함수가 할당되서 함수가 되었잖아?
  // 그러니 그 함수도 어떤 인자값을 받아야 하는데 그 인자를 받을 자리를 표시해서 이것이 이 자리에 인자값을 받는 함수다 라고 명시해준 것.
  // 이거 하나 빠트려서 제대로 작동이 안됬었음ㅠㅠ 앞으로 중첩함수를 리턴받아서 함수를 만들어줄때는 항상 끝에 (); 인자값이 들어갈 자리를 명시해줘야 함!
  // 즉, 더 쉽게 말하면, '할당해주는 바깥쪽 함수를 호출하라'는 의미라고도 볼 수 있음! 저걸 실행하면 중첩함수가 리턴되니까 makeIndentityLutTexture에는 중첩함수가 할당되겠지
  // 따라서 이제 어딘가에서 makeIndentityLutTexture()를 호출한다면, return된 중첩함수를 호출시키는 거임.

  // 필터가 들어간 것(identity), 안들어간 것(identity not filtered) 2개를 만들어 줌.
  // 필터가 들어간 경우는 filter: true 이므로, effectLUT 패스를 사용하고, effectLUTNearest 패스는 사용하지 않음.
  // 필터가 들어가지 않은 경우 filter: false 이므로, effectLUT 패스를 사용하지 않고, effectLUTNearest 패스를 사용함.
  // 근데 중요한 차이점은, effectLUTNearest 패스에 들어가는 쉐이더 코드에는 #define FILTER_LUT true 가 완전 주석처리 되어있음.
  // 그래서 필터링을 사용하지 않는 경우라고 설명하는 것 같음. 저 코드가 들어가 있는 쉐이더를 사용한다면(identity) GPU가 선형적으로 색상값을 채워넣지만,
  // 저 코드가 들어있지 않은 쉐이더를 사용한다면(identity not filtered) 알아서 색상값을 채워넣는 게 아니라, 
  // 할당받은 DataTexture, 즉 3DLUT에서 가장 가까이에 있는 색상값을 찾아서 사용하는 것 같음. 
  const lutTextures = [{
      name: 'identity',
      size: 2,
      filter: true,
      // makeIdentityLutTexture()를 호출하는 순간 내부의 중첩함수가 호출되는 것. 왜냐? makeIndentityLutTexture의 함수를 정의할 때
      // 끝에 ();를 붙였기 때문에 정의된 바깥쪽 함수를 호출한 게 되어버림. 그래서 중첩함수 리턴이 실행되서 makeIndentityLutTexture에 할당된거고,
      // makeIndentityLutTexture를 실행하면서 필터 객체를 전달하면 내부의 중첩함수가 호출되어 결과적으로 texture에는 생성된 DataTexture가 리턴되어 할당될거임. 
      texture: makeIdentityLutTexture(THREE.LinearFilter)
    },
    {
      name: 'identity not filtered',
      size: 2,
      filter: false,
      texture: makeIdentityLutTexture(THREE.NearestFilter)
    },
  ];

  // lutNameIndexMap 객체에는 각 lutTexture의 이름과 lutTextures 배열 상에서의 인덱스를 매핑해서 저장해 둠
  const lutNameIndexMap = {};
  lutTextures.forEach((info, index) => {
    lutNameIndexMap[info.name] = index;
  });

  // lutSettings.lut에는 dat.GUI에서 입력받은 인덱스값에 따라 어떤 LUTTexture 를 사용할건지 지정해 줌.
  const lutSettings = {
    lut: lutNameIndexMap.identity,
  }

  // dat.GUI로 입력창을 하나 만들어서 lutNameIndexMap에 존재하는 key값으로 입력값을 받으면, 
  // 그 key값에 해당하는 인덱스 value를 lutSettings.lut에 넣어줄거임. 
  const gui = new GUI({
    width: 300
  });
  gui.add(lutSettings, 'lut', lutNameIndexMap);

  // 모델용 씬 생성
  const scene = new THREE.Scene();

  // 배경용 씬 및 배경용 카메라(Orthographic camera) 생성... 왜냐면 배경은 평면 메쉬에 텍스처를 렌더해서 XY축을 기준으로 세워둘거니까 정사영 카메라로 2D 평면을 찍어주면 됨.
  const sceneBG = new THREE.Scene();
  const cameraBG = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  // 배경 이미지 텍스처를 로드해 담아놓을 변수와 그 텍스처로 평면 메쉬를 만들어 담아놓을 변수
  let bgMesh;
  let bgTexture;

  // 배경이미지 텍스처를 로드한 뒤, 해당 텍스처로 평면 메쉬를 만들어서 배경용 씬에 추가해 줌.
  {
    const loader = new THREE.TextureLoader();
    bgTexture = loader.load('./image/beach.jpg');
    const planeGeo = new THREE.PlaneGeometry(2, 2); // 위에서 정사영 카메라가 left, right, top. bottom을 각각 -1, 1, 1, -1로 했으므로, camera width = 2, height = 2니까 배경용 카메라에 평면 메쉬가 꽉 차겠지
    const planeMat = new THREE.MeshBasicMaterial({ // 배경용 메쉬니까 조명에 따라 반응할 필요가 없는 베이직 머티리얼을 사용함.
      map: bgTexture,
      depthTest: false, // 픽셀과 카메라의 거리값에 따라 다른 물체보다 더 멀리있거나 하는 픽셀은 렌더를 안해주는 등 거리값에 따른 렌더 여부를 결정함.
      // 근데 지금 배경용 씬에 배경용 메쉬 하나만 추가할 것이므로, 다른 물체에 가리고 자시고 할 게 없지. 그니까 depthTest 옵션을 꺼두는 거임.
    });
    bgMesh = new THREE.Mesh(planeGeo, planeMat);
    sceneBG.add(bgMesh);
  }

  /**
   * 직각삼각형에서 tan(angle) = 높이 / 밑변 공식을 활용해서 
   * 밑변 = 높이 / tan(angle)로 육면체가 카메라의 절두체 안으로 들어올 수 있는 육면체 ~ 카메라 사이의 거리값을 구할 수 있음.
   * 자세한 공식 유도 과정은 튜토리얼 웹사이트 참고.
   * 
   * 이 거리를 구할 때 bounding box의 크기(boxSize)와 중심점(boxCenter)을 넘겨줘서 구하는 함수를 만든 것.
   */
  function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5; // 카메라 절두체 화면크기의 절반값. 직각삼각형 높이에 해당.
    // 인자로 전달받은 카메라 시야각 절반값. tan() 메서드에 할당할 각도값. 
    // fov는 항상 degree 단위를 받기 때문에 tan()에 넣어주려면 radian단위로 바꿔줘야 함.
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const distance = halfSizeToFitOnScreen / Math.tan(halfFovY); // 카메라와 bounding box 사이의 거리값. 탄젠트값으로 직각삼각형 밑변 길이 구하는 공식

    // 카메라 위치 ~ bounding box 중심점 사이의 거리를 벡터로 나타낸 값을 '길이는 1이고 방향값만 갖는 단위벡터'로 만들어버림.
    // 근데 중간에 Vector3(1, 0, 1) 이거를 곱해줬던 이유가 뭐냐면, 카메라와 bounding box 중심점의 y좌표값이 일반적으로 엄청 차이가 크기 때문에
    // 단위벡터의 y좌표값을 0으로 만들어주지 않으면 카메라가 bounding box의 중심점을 향해 위로 솟는 방향벡터가 되어버림.
    // 그래서 해당 방향벡터가 y축으로 향하지 않도록, 즉 항상 XZ면에 평행하도록 만들어버린 것.
    const direction = (new THREE.Vector3())
      .subVectors(camera.position, boxCenter)
      .multiply(new THREE.Vector3(1, 0, 1))
      .normalize();

    // 방향벡터에 스칼라값인 distance를 곱해주면 방향은 카메라 위치 ~ bounding box 중심점과 동일하고, 거리는 distance인 벡터가 리턴될거고,
    // 이 벡터만큼을 boxCenter 좌표값부터 더해준다면 camera가 distance만큼 떨어졌을 때 있어야 할 위치값이 나오겠지
    camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

    // 절두체의 near는 boxSize의 0.01배, far는 100배로 지정
    camera.near = boxSize / 100;
    camera.far = boxSize * 100;

    // 카메라의 속성값을 바꿔줬으니 업데이트 메서드를 호출해줘야 함.
    camera.updateProjectionMatrix();

    // 카메라가 움직이더라도 시선은 boxCenter에 고정되어 있도록 함
    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  }

  // gltf 파일을 로드해온 뒤, scene 객체의 bounding box 사이즈 및 중심점을 구하고, 그 값들을 전달받아서 카메라 절두체 사이즈, 카메라 ~ 중심점 사이의 거리를 구해주는 frameArea 함수를 호출함.
  {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('./model/3dbustchallange_submission/scene.gltf', (gltf) => {
      // onLoad 함수에서 인자로 전달받은 gltf JSON 오브젝트 안에서도 씬그래프 최상위 노드에 해당하는 scene 객체만 root에 할당한 뒤, 
      // 얘의 bounding box를 구해서 절두체 사이즈, 카메라 거리값 등을 구해줄거임.
      const root = gltf.scene;
      scene.add(root); // 일단 씬에 추가해주고

      // 씬과 그것의 하위노드에 존재하는 하위 노드들의 머티리얼을 {material: material}로 전달해 줌. (앞에 material은 임의로 이름지은 인자, 뒤에 머티리얼은 gltf JSON 데이터안에 존재하는 key값이 material인 것의 value)
      // 만약 material이 0이 아닌 값으로 존재한다면, if block으로 들어가서 depthWrite를 활성화하여 해당 머티리얼이 깊이 버퍼에 영향을 미치도록, 즉 깊이에 의한 렌더가 적용되도록 한다는 거겠지.
      // 그런데 원래 모든 material은 depthWrite의 기본값이 true 이기는 함.
      root.traverse(({
        material
      }) => {
        if (material) {
          material.depthWrite = true;
        }
      });

      // root 객체와 그것의 자식 노드들의 전역 변환을 업데이트 해주는 메서드
      // 근데 이 예제에서는 딱히 자식 노드들의 전역 변환을 안해주는데 굳이 왜 호출한걸까...?
      root.updateMatrixWorld();

      // 인자로 전달한 root 객체를 감싸는 3차원 공간상의 bounding box를 계산해서 생성함.
      const box = new THREE.Box3().setFromObject(root);

      const boxSize = box.getSize(new THREE.Vector3()).length(); // bounding box 전체를 대각선 방향으로 가로지르는 직선 길이를 구해줌.
      const boxCenter = box.getCenter(new THREE.Vector3()); // bounding box의 가운데 좌표값을 구해서 인자로 전달한 Vector3에 복사해서 리턴해 줌.

      // boxSize, boxCenter, camera 등의 값을 전달하면서 frameSize 함수 호출. 이 함수 안에서 모델용 씬을 담는 카메라의 위치, 절두체 사이즈 등을 지정해 줄거임.
      // 화면 크기의 절반 높이값으로 전달해주는 인자에 0.4를 곱해서 전달하는데, 아마 처음에 페이지를 로드할 때 카메라를 모델에 좀 더 가까이 위치하는 distance값을 구하기 위해 0.4배 줄여서 전달한 것 같음.
      frameArea(boxSize * 0.4, boxSize, boxCenter, camera);

      // OrbitControls가 perspective camera의 dolly out 할 때의 최대 거리를 지정해 줌.
      controls.maxDistance = boxSize * 10;
      controls.target.copy(boxCenter); // OrbitControls가 카메라를 움직일 때 카메라의 시선을 bounding box의 중심점으로 맞춘 것
      controls.update(); // 값을 바꿔줬으니 항상 업데이트 해줄 것.
    });
  }

  // 쉐이더를 이용한 후처리 패스를 두 개 만들건데, shaderPass들에 각각 넣어줄 쉐이더 코드를 작성한 것. 
  const lutShader = {
    uniforms: {
      tDiffuse: {
        value: null
      }, // the previous pass's result
      lutMap: {
        value: null
      },
      lutMapSize: {
        value: 1,
      },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: `
      #include <common>

      #define FILTER_LUT true

      uniform sampler2D tDiffuse;
      uniform sampler2D lutMap;
      uniform float lutMapSize;

      varying vec2 vUv;

      vec4 sampleAs3DTexture(sampler2D tex, vec3 texCoord, float size) {
        float sliceSize = 1.0 / size;                  // space of 1 slice
        float slicePixelSize = sliceSize / size;       // space of 1 pixel
        float width = size - 1.0;
        float sliceInnerSize = slicePixelSize * width; // space of size pixels
        float zSlice0 = floor( texCoord.z * width);
        float zSlice1 = min( zSlice0 + 1.0, width);
        float xOffset = slicePixelSize * 0.5 + texCoord.x * sliceInnerSize;
        float yRange = (texCoord.y * width + 0.5) / size;
        float s0 = xOffset + (zSlice0 * sliceSize);

        #ifdef FILTER_LUT

          float s1 = xOffset + (zSlice1 * sliceSize);
          vec4 slice0Color = texture2D(tex, vec2(s0, yRange));
          vec4 slice1Color = texture2D(tex, vec2(s1, yRange));
          float zOffset = mod(texCoord.z * width, 1.0);
          return mix(slice0Color, slice1Color, zOffset);

        #else

          return texture2D(tex, vec2( s0, yRange));

        #endif
      }

      void main() {
        vec4 originalColor = texture2D(tDiffuse, vUv);
        gl_FragColor = sampleAs3DTexture(lutMap, originalColor.xyz, lutMapSize);
      }
    `,
  };

  const lutNearestShader = {
    uniforms: {
      ...lutShader.uniforms
    }, // 이 쉐이더의 uniforms는 lutShader의 uniforms값들을 그대로 복사해서 사용한다는 뜻.
    vertexShader: lutShader.vertexShader, // 이것도 마찬가지
    fragmentShader: lutShader.fragmentShader.replace('#define FILTER_LUT', '//'), // 이거는 lutShader.fragmentShader에서 '#define FILTER_LUT'부분을 '//'로 바꿔서 아예 한 줄을 통째로 주석처리 한다는 뜻.
  };

  // 위에서 가져온 각각의 쉐이더 코드로 ShaderPass를 만들어 줌
  // 또한 각 ShaderPass.renderToScreen을 모두 true로 해줌으로써, 두 shaderPass 모두가 최종적으로 캔버스에 결과물을 렌더해야 함.
  // 왜냐하면, 두 패스가 섞인 결과물이 LUT를 이용한 최종적인 후처리 결과물이 되기 때문.
  const effectLUT = new ShaderPass(lutShader);
  effectLUT.renderToScreen = true;
  const effectLUTNearest = new ShaderPass(lutNearestShader);
  effectLUTNearest.renderToScreen = true;

  // 이 예제에서는 배경용 씬과 카메라, 모델용 씬과 카메라를 분리했으므로, 씬을 렌더타겟에 넘겨주는 RenderPass 역시 따로 생성해줘야 함.
  const renderModel = new RenderPass(scene, camera);
  // 이거는 모든 패스들이 기본적으로 상속받는 옵션값인 clear 즉, 패스 체이닝에서 현재 pass 이전까지의 화면을 초기화할지 여부를 결정함.
  // 원래는 모든 pass들이 기본값을 false로 상속을 받는데, RenderPass만 true를 기본값으로 지정해놓음.
  // 근데 renderBG가 패스 체이닝에서 가장 먼저 오고, 그 다음이 renderModel인데, 여기서 clear 해버리면
  // 앞에서 renderBG 패스가 렌더타겟에 렌더링한 배경용 씬이 지워져 버리잖아. 그럼 안되니까 clear를 false로 지정한 것.
  renderModel.clear = false;
  const renderBG = new RenderPass(sceneBG, cameraBG);

  // EffectComposer를 생성함. 이때 EffectComposer가 패스 체이닝에서 내부적으로 사용할 렌더타겟을 직접 옵션을 지정해서 만든 뒤 넘겨줄 수도 있음.
  const rtParameters = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
  }; // 렌더 타겟을 직접 만들 때 해당 렌더 타겟에서 생성되는 텍스처에 대한 옵션값들을 지정해준 것 같음.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, rtParameters));

  // 이제 패스 체인에 패스들을 순서대로 추가해 줌
  composer.addPass(renderBG);
  composer.addPass(renderModel);
  composer.addPass(effectLUT);
  composer.addPass(effectLUTNearest);

  // resize renderer
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth * window.devicePixelRatio | 0;
    const height = canvas.clientHeight * window.devicePixelRatio | 0;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  // 이전 프레임의 타임스탬프값을 저장할 변수
  let then = 0;

  // animate
  function animate(now) {
    now *= 0.001; // 밀리초 단위 타임스탬프값을 초 단위로 변환
    const delta = now - then; // 마지막 프레임을 렌더한 이후의 시간값. EffectComposer.render 메서드를 호출할 때 전달해줘야 함.
    then = now; // 마지막 프레임의 타임스탬프값을 매번 overwrite 해줌.

    // 렌더러를 리사이즈 해줬으면 카메라 비율(aspect)도 리사이징된 사이즈에 맞게 업데이트 해줌
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      const canvasAspect = canvas.clientWidth / canvas.clientHeight; // canvasAspect 를 따로 구해서 할당해놓은건 아래에서 이미지 비율과 캔버스 비율값을 비교하는 aspect를 구하는 데에도 쓸 수 있기 위함.
      camera.aspect = canvasAspect;
      camera.updateProjectionMatrix(); // 카메라의 속성값을 바꿔줬으면 업데이트를 해야 함.

      // EffectComposer가 패스 체인을 모두 적용해 준 결과물 씬을 캔버스에 렌더링해줄 때, 캔버스 크기가 리사이징 되었다면 결과물의 크기도 리사이징된 캔버스 크기로 맞춰주어야 함.
      composer.setSize(canvas.width, canvas.height);

      // imageAspect 의 경우, 텍스처를 로드하는 데 시간이 걸리므로, 이미지가 로드되지 않았을 경우 값을 1로 할당해버림.
      const imageAspect = bgTexture.image ? bgTexture.image.width / bgTexture.image.height : 1;
      const aspect = imageAspect / canvasAspect;

      /**
       * aspect > 1 이면, 렌더러 캔버스보다 이미지의 width가 더 길어보이는 비율인 상태.
       * 이 상태에서는 이미지 텍스처가 발라진 bgMesh가 width 방향으로 짜부되겠지?
       * 이럴 경우, bgMesh의 y방향(즉, height)의 scale은 1만 곱해줘서 그대로 두고,
       * x방향의 scale만 aspect(imageAspect/canvasAspect) 비율만큼 곱해주면
       * bgMesh가 x 방향으로 aspect 배 만큼 늘어나서 짜부된 이미지가 펴지겠지? 
       * 
       * 반대로 aspect < 1 이면, 렌더러 캔버스보다 이미지 height이 더 길어보이는 비율인 상태
       * 이 상태에서는 이미지 텍스처가 발라진 bgMesh가 height 방향으로 짜부되겠지?
       * 이럴 경우, bgMesh의 x방향(즉, width) scale은 1만 곱해줘서 그대로 두고.
       * y방향의 scale만 aspect 비율만큼 곱해주면
       * bgMesh가 y 방향으로 aspect 배 만큼 늘어나서 짜부된 이미지가 펴지겠지?
       */
      bgMesh.scale.x = aspect > 1 ? aspect : 1;
      bgMesh.scale.y = aspect > 1 ? 1 : 1 / aspect;
    }

    // dat.GUI의 입력창에서 받는 index값에 따라 어떤 LUT 텍스처에 관한 정보 객체가 할당될 지 결정됨.
    const lutInfo = lutTextures[lutSettings.lut];

    // 해당하는 LUT 텍스처 정보 객체의 filter가 true냐 false냐에 따라 effect에는 각기 다른 shaderPass가 할당될거임
    // 만약 lutInfo가 필터가 들어간 애면 effectLUT, 안들어간 애면 effectLUTNearest가 할당되겠지
    const effect = lutInfo.filter ? effectLUT : effectLUTNearest;
    // enable은 모든 pass들의 공통 상속 옵션으로, 해당 shaderPass를 사용할 지 말 지를 결정함.
    // 만약 lutInfo가 필터가 들어간 애면 effectLUT는 사용하고, effectLUTNearest는 사용 안하겠네
    // 반대로 lutInfo가 필터가 안들어간 애면 effectLUT는 사용 안하고, effectLUTNearest를 사용하겠지
    effectLUT.enabled = lutInfo.filter;
    effectLUTNearest.enabled = !lutInfo.filter;

    // 할당된 DataTexture 인스턴스가 할당된 lutInfo.texture를 lutTexture에 넣어줌.
    const lutTexture = lutInfo.texture;

    // effect에 할당된 shaderPass의 각각의 uniforms값에 lutTexture와 size를 할당해 줌.
    effect.uniforms.lutMap.value = lutTexture;
    effect.uniforms.lutMapSize.value = lutInfo.size;

    // EffectComposer의 후처리가 적용된 renderer를 렌더하려면 WebGLRenderer.render() 대신 EffectComposer.render()를 매 프레임마다 호출해야 함.
    composer.render(delta);

    requestAnimationFrame(animate); // 내부에서 반복 호출
  }

  requestAnimationFrame(animate);
}

main();