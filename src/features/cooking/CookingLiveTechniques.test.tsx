import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookingLiveTechniques } from "./CookingLiveTechniques";

vi.mock("@/hooks/useActiveProfile",()=>({
  useActiveProfile:()=>({profileId:null,profile:null}),
}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{
    from:(table:string)=>{
      if(table!=="cooking_recipes") throw new Error("Unexpected query: "+table);
      return {select:()=>({eq:()=>({in:()=>({
        order:async()=>({data:[],error:null}),
      })})})};
    },
    functions:{invoke:vi.fn(()=>{throw new Error("Recipe release gate bypass");})},
  },
}));
afterEach(cleanup);
describe("release-gated illustrated live technique screen",()=>{
  it("shows an illustrated locked workstation when no server recipes are active",async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><CookingLiveTechniques/></QueryClientProvider>);
    expect(await screen.findByText(/Live baking, soups and drinks are not released yet/))
      .toBeInTheDocument();
    expect(screen.getByRole("img",{name:/apple pie ready dish illustration/i})).toBeVisible();
    expect(screen.queryByRole("button",{name:"Start cooking"})).not.toBeInTheDocument();
    client.clear();
  });
});
