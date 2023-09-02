import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

const FeatureList = [
  {
    title: "DMHelper on itch.io",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
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
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
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
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        Official Website for DMHelper. You can find news, information, and
        download links here.
      </>
    ),
    link: "https://www.dm-helper.com/",
  },
];

function Feature({ Svg, title, description, link }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
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
