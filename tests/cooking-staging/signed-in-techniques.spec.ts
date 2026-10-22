import { expect, test, type Page } from "@playwright/test";

// Extra certification only after staging database is seeded with three active
// technique recipes and disposable perishable ingredient lots. NO production writes.
const runTechniques=process.env.COOKING_STAGING_TECHNIQUES==="YES_STAGING_ONLY";
const stagingOrigin=new URL(process.env.COOKING_STAGING_SUPABASE_URL!).origin;
const scenarios=[
  {slug:"apple-pie",ingredients:["Apples","Butter","Flour","Sugar"],
    vessel:"baking tray",heat:true,waitMs:16_000},
  {slug:"vegetable-soup",ingredients:["Carrot","Onion","Potato","Vegetable Stock"],
    vessel:"pot",heat:true,waitMs:13_000},
  {slug:"spiced-tea",ingredients:["Milk","Spices","Tea"],
    vessel:"mixing jug",heat:false,waitMs:0},
] as const;

async function signedInStaging(page:Page){
  const unexpected:string[]=[];
  await page.route("**/*",async route=>{
    const origin=new URL(route.request().url());
    if(/(^|\.)supabase\.co$/.test(origin.hostname)&&origin.origin!==stagingOrigin){
      unexpected.push(origin.origin);
      await route.abort("blockedbyclient");
    }else await route.continue();
  });
  await page.goto("/auth");
  await page.locator("#login-email").fill(process.env.COOKING_STAGING_EMAIL!);
  await page.locator("#login-password").fill(process.env.COOKING_STAGING_PASSWORD!);
  const login=page.waitForResponse(r=>r.url().startsWith(stagingOrigin+"/auth/v1/token")
    &&r.request().method()==="POST");
  await page.locator("form:has(#login-email) button[type=submit]").click();
  expect((await login).ok()).toBe(true);
  await page.goto("/cooking");
  await expect(page.getByRole("heading",{name:"Live baking, soups and drinks"})).toBeVisible();
  expect(unexpected).toEqual([]);
  return unexpected;
}

test.describe("signed-in staging certification for non-pan methods",()=>{
  test.skip(!runTechniques,"Requires explicit techniques-only staging seed/write opt-in");
  test("bakes, simmers and mixes using server actions and illustrated stations",async({page})=>{
    test.setTimeout(300_000);
    const foreign=await signedInStaging(page);
    for(const scenario of scenarios){
      // Recipes/food/ingredient lots must be seeded in disposable staging
      // before opting in. The test intentionally does not create recipes.
      await page.locator("#cooking-live-technique-recipe").selectOption(scenario.slug);
      const chosen=page.locator("#cooking-live-technique-recipe");
      await expect(chosen).toHaveValue(scenario.slug);
      await page.getByRole("button",{name:"Start cooking",exact:true}).click();
      const tray=page.getByRole("region",{name:"Reserved ingredient tray"});
      await expect(tray).toBeVisible();
      const scene=page.getByTestId("cooking-equipment-scene");
      await expect(scene).toBeVisible();
      for(const name of scenario.ingredients){
        await tray.getByRole("button",{name:"Select "+name}).click();
        await tray.getByRole("button",{name:"Add selected to "+scenario.vessel}).click();
        await expect(tray.getByRole("button",{name:"Select "+name})).toHaveCount(0);
      }
      await page.reload();
      await expect(scene).toBeVisible();
      await expect(page.getByText("Loaded "+scenario.ingredients.length+"/"+scenario.ingredients.length,
        {exact:false})).toBeVisible();
      if(scenario.heat){
        await page.getByRole("group",{name:"Adjust heat"})
          .getByRole("radio",{name:"Medium"}).check();
        await page.waitForTimeout(scenario.waitMs);
        await expect(page.getByTestId("cooking-equipment-scene"))
          .toHaveAttribute("data-stage","Ready");
      }else{
        for(let i=1;i<=3;i++){
          await page.getByRole("button",{name:/^Stir drink/}).click();
          await expect(page.getByRole("button",{name:"Stir drink ("+i+"/5)"})).toBeVisible();
        }
        await expect(page.getByTestId("cooking-equipment-scene"))
          .toHaveAttribute("data-stage","Ready");
      }
      await page.getByRole("button",{name:"Plate all ingredients"}).click();
      await expect(page.getByRole("button",{name:"Finish and save food"})).toBeEnabled();
      await page.getByRole("button",{name:"Finish and save food"}).click();
      await expect(page.getByText(/Cooked food saved to your inventory/)).toBeVisible();
      await page.getByRole("button",{name:"Return to recipe selection"}).click();
      await expect(page.getByRole("button",{name:"Start cooking",exact:true})).toBeVisible();
      expect(foreign).toEqual([]);
    }
  });
});
