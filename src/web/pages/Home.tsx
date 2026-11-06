import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { defaultCatalog, generateModel, type FigureDesign } from '../../engine/index';
import { Viewer3D } from '../components/Viewer3D';

const HERO_DESIGN = {
  size: 'S',
  skin: 'nougat',
  hairColor: 'black',
  hairStyle: 'volume',
  facialHair: 'none',
  glasses: true,
  glassesColor: 'black',
  shirtColor: 'yellow',
  jacket: true,
  jacketColor: 'darkGreen',
  bottomStyle: 'pants',
  bottomColor: 'darkBlue',
  shoeColor: 'white',
  base: true,
  baseColor: 'darkGray',
} as FigureDesign;

const FAQ = [
  {
    q: 'Figür bana gerçekten benzeyecek mi?',
    a: 'Figürün tuğla ölçeğinde, büyük kafalı ve sevimli bir tarzda. Ten rengin, saç modelin ve rengin, sakalın, gözlüğün ve kıyafet renklerin fotoğraftan alınır. Sonra hepsini kendin ince ayarlayabilirsin.',
  },
  {
    q: 'Fotoğrafım nereye gidiyor?',
    a: 'Fotoğraf analizi tamamen senin tarayıcında yapılır, sunucumuza yüklenmez. Sipariş verirken istersen küçük bir kopyasını üretim kontrolü için bizimle paylaşabilirsin.',
  },
  {
    q: 'Kutuda neler var?',
    a: 'Figürün için gereken tüm tuğlalar renklere göre ayrılmış poşetlerde ve adım adım, katman katman montaj kılavuzu. Kılavuzun 3D hali sipariş sayfanda da duruyor.',
  },
  {
    q: 'Hangi parçalar kullanılıyor?',
    a: 'Sadece standart, her yerde bulunan tuğlalar: 1x1 ile 2x4 arası tuğlalar ve kaide için bir 8x8 plaka. Özel baskılı ya da kalıplı parça yok; parça kaybolursa kolayca yerine koyabilirsin.',
  },
  {
    q: 'Ne kadar sürede gelir?',
    a: 'Ödemen onaylandıktan sonra siparişin genelde 3-5 iş günü içinde hazırlanıp kargoya verilir.',
  },
];

export function Home() {
  const model = useMemo(() => generateModel(HERO_DESIGN, defaultCatalog()), []);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Yeni · Kişiye özel tuğla figür</span>
            <h1>
              Fotoğrafını yükle,
              <br />
              <span className="hl">tuğladan sen</span> kapına gelsin.
            </h1>
            <p className="lead">
              Fotoğrafındaki seni tuğlalarla yapılmış 3D bir figüre çeviriyoruz. Parçalar ve adım adım montaj kılavuzu kutuda,
              yapması sana kalıyor.
            </p>
            <div className="hero-cta">
              <Link to="/tasarla" className="btn btn-primary btn-lg">
                Figürünü tasarla
              </Link>
              <a href="#nasil" className="btn btn-ghost btn-lg">
                Nasıl çalışır?
              </a>
            </div>
            <ul className="hero-facts">
              <li>
                <b>~{Math.round(model.stats.heightMm / 10)} cm</b> boy
              </li>
              <li>
                <b>~{Math.round(model.stats.brickCount / 10) * 10}</b> parça
              </li>
              <li>
                <b>{model.stats.steps}</b> adımda yapım
              </li>
            </ul>
          </div>
          <div className="hero-visual">
            <div className="hero-stage">
              <Viewer3D bricks={model.bricks} autoRotate azimuth={0.6} label="Örnek tuğla figür" />
            </div>
            <p className="muted small center">Örnek figür · sürükleyip çevirebilirsin</p>
          </div>
        </div>
      </section>

      <section id="nasil" className="section">
        <div className="container">
          <h2 className="section-title">Üç adımda kendi figürün</h2>
          <div className="steps3">
            <div className="card step-card">
              <span className="step-no">1</span>
              <h3>Fotoğrafını yükle</h3>
              <p>Yüzünün ve kıyafetinin göründüğü bir fotoğraf seç. Analiz saniyeler içinde, tarayıcında yapılır.</p>
            </div>
            <div className="card step-card">
              <span className="step-no">2</span>
              <h3>Figürünü özelleştir</h3>
              <p>Saç, sakal, gözlük, kıyafet ve renkleri 3D önizlemede anında gör, istediğin gibi değiştir.</p>
            </div>
            <div className="card step-card">
              <span className="step-no">3</span>
              <h3>Kutun gelsin, kendin yap</h3>
              <p>Tüm parçalar ve katman katman montaj kılavuzu kargoyla gelir. Bir akşamda kendi figürünü yaparsın.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container features">
          <div>
            <h2 className="section-title left">Standart parçalar, sağlam yapı</h2>
            <p className="lead">
              Figürünü bilgisayarda katman katman planlıyoruz. Her tuğla bir alttakine kenetlenecek şekilde yerleştiriliyor, böylece
              figürün dağılmıyor. Dışarıdan görünmeyen iç kısımlarda renk fark etmediği için fiyat da makul kalıyor.
            </p>
          </div>
          <ul className="feature-list">
            <li>
              <b>Kolay bulunan tuğlalar</b>
              <span>1x1 ile 2x4 arası standart tuğlalar ve 8x8 kaide plakası.</span>
            </li>
            <li>
              <b>Renklere göre poşetli</b>
              <span>Aradığın parçayı hızla bulursun.</span>
            </li>
            <li>
              <b>3D montaj kılavuzu</b>
              <span>Basılı kılavuzun yanında her adımı telefonda çevirerek de izleyebilirsin.</span>
            </li>
            <li>
              <b>Gizlilik önce</b>
              <span>Fotoğrafın sunucumuza yüklenmeden analiz edilir.</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="sss" className="section">
        <div className="container narrow">
          <h2 className="section-title">Sık sorulan sorular</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <div className="center" style={{ marginTop: 32 }}>
            <Link to="/tasarla" className="btn btn-primary btn-lg">
              Hemen başla
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
