import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import Twig from 'twig';
import axios from 'axios';
import md5 from 'md5';

class TemplateR{
    constructor(){
        if(! TemplateR.instance){
          this._data = [];
          this._ids = [];
          this._urls = [];
          this.cors = '';
          this.twig = Twig;
          this.loader = new Promise((resolve,reject)=>{
              resolve();
          });
          TemplateR.instance = this;
        }
        return TemplateR.instance;
    }
    twigLoader(o){
        this.loader = RA.allP(
            R.map(
                R.pipeP(
                    R.cond([
                        [R.has('url'),o=>this.twigGet(o)],
                        [R.has('twig'),o=>this.twigAdd(o)]
                    ])
                ),o
            )
        );
      return this.loader;
    }
    corsMe(url){
        this.cors = url;
    }
    twigAdd(o){
        let md5Twig = md5(o.twig);
        if(
            !R.find(R.propEq('md5Twig',md5Twig))(this._data)
            && 
            !R.find(R.propEq('id',o.id))(this._data)
        ){
            this.twig.twig({
                id: o.id,
                data: o.twig
            });
            this._data.push({
                id: o.id,
                md5Twig:md5Twig,
                url: typeof o.url != 'undefined'?o.url:false 
            });
            this._ids.push({
              id:o.id,
              md5Twig:md5Twig
            });
        }else if(
          p = R.find(R.propEq('md5Twig',md5Twig))(this._data)
        ){
            console.error('Warning: Template Already exists');
            console.log('Original',p);
            console.log('Yours',o);
            if(p.id!=o.id){
                this._ids.push({ref:p.id,id:o.id,md5Twig:md5Twig});
            }
        }else if(
          p = R.find(R.propEq('id',o.id))(this._ids)
        ){
            let originalItem = R.find(R.propEq('md5Twig',p.md5Twig))(this._data);
            console.log('We already have this ID, But we don\'t have a copy of this template in the system...Please use another id',originalItem);
        }
      return o;
    }
    twigGet(o){
        if(!R.find(
            R.propEq('url',o.url))(this._urls)
        ){
            //console.log('going to fetch',o);
            this._urls.push({'url':o.url});
            return axios.get(this.cors+o.url)
                .then((r)=>{
                   o.twig = r.data;
                   return this.twigAdd(o);
                })
                .catch((e)=>{
                    console.log('Could not fetch the template',o);
                    console.log('This is usually due to a CORS issue');
                    console.log(e);
                    o.error = 'could not fetch this template, this is usually something to do with CORS';
                    return o;
                });
        }
    }
    renderToString(o){
      if(!o.ref || !o.data){
        console.error('You have not given me the right type of object');
        console.log('Expected Object:',{ref:'template reference',data:'data you would like to use in the template'});
      }
      let ref = R.find(R.propEq('id',o.ref))(this._ids);
      ref = typeof ref.ref != 'undefined' ? ref.ref:ref.id;
      let renderedString = this.twig.twig({ref:ref}).render(o.data);
      return renderedString;
    }
    renderToSelector(selector,o){
        this.loader
            .then(()=>{
              this.renderToSelectorNoLoader(selector,o);
            });
    }
    renderToSelectorNoLoader(selector,o){
      let renderedString = this.renderToString(o);
      R.map(
        (e)=>{
          e.innerHTML += renderedString;
        },
        document.querySelectorAll(selector)
      );      
    }
    renderItemsToSelectors(items){
      this.loader
        .then(()=>{
          R.map((o)=>{this.renderToSelector(o.selector,o.data)},items);
      });
    }
    get(id){
        return this._data.find(d=> d.id === id);
    }
    getAll(){
        return this._data;
    }
}

const instance = new TemplateR();

export default instance;