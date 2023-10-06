import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

const FeatureList = [
  {
    title: "DMHelper on itch.io",
    Img: require("@site/static/img/icon_preview.png").default,
    description: (
      <>
        DMHelper is Donationware. You can download it for free, and if you like
        it - contributions are appreciated 🙂
      </>
    ),
    link: "https://dm-helper.itch.io/",
  },
  {
    title: "DMHelper on Discord",
    Img: require("@site/static/img/icon_playerswindow.png").default,
    description: (
      <>
        Didn't find an answer to your question here? Join the Discord server and
        ask away!
      </>
    ),
    link: "https://discord.gg/Uzum3mCeDG",
  },
  {
    title: "DMHelper Website",
    Img: require("@site/static/img/icon_contentparty.png").default,
    description: (
      <>
        Official Website for DMHelper. You can find news, information, and
        download links here.
      </>
    ),
    link: "https://www.dm-helper.com/",
  },
];

function Feature({ Img, title, description, link }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <img className={styles.featureImg} role="img" src={Img} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>
          {description} <a href={link}>[Click]</a>
        </p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
